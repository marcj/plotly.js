/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3 = require('d3');

var constants = require('./constants');
var attachFxHandlers = require('../sunburst/attach_fx_handlers');
var helpers = require('../sunburst/helpers');

var Lib = require('../../lib');
var Drawing = require('../../components/drawing');
var svgTextUtils = require('../../lib/svg_text_utils');

var partition = require('./partition');
var styleOne = require('./style').styleOne;

var isUp = true; // for Ancestors

module.exports = function drawAncestors(gd, cd, entry, slices, opts) {
    var width = opts.width;
    var height = opts.height;

    var dirDifY = opts.dirDifY;

    var viewX = opts.viewX;
    var viewY = opts.viewY;

    var pathSlice = opts.pathSlice;
    var toMoveInsideSlice = opts.toMoveInsideSlice;
    var rightToLeft = opts.rightToLeft;

    var hasTransition = opts.hasTransition;
    var handleSlicesExit = opts.handleSlicesExit;
    var makeUpdateSliceIntepolator = opts.makeUpdateSliceIntepolator;
    var makeUpdateTextInterpolar = opts.makeUpdateTextInterpolar;

    var fullLayout = gd._fullLayout;
    var cd0 = cd[0];
    var trace = cd0.trace;

    var eachWidth = opts.width / (entry.height + 1);

    var sliceData = partition(entry, [width, height], {
        packing: 'dice',
        mirror: {
            x: rightToLeft,
            y: false,
            xy: false
        },
        offset: 0,
        padding: {
            top: 0,
            left: rightToLeft ? 0 : eachWidth,
            right: rightToLeft ? eachWidth : 0,
            bottom: 0
        }
    }).descendants();

    slices = slices.data(sliceData, function(pt) {
        if(isNaN(pt.x0)) pt.x0 = 0;
        if(isNaN(pt.x1)) pt.x1 = width;

        return helpers.getPtId(pt);
    });

    slices.enter().append('g')
        .classed('directory', true);

    handleSlicesExit(slices, isUp, [width, height], pathSlice);

    slices.order();

    var updateSlices = slices;

    updateSlices.each(function(pt) {
        pt._hoverPos = [(rightToLeft ?
            viewX(pt.x1 - eachWidth) :
            viewX(pt.x0)) + eachWidth / 2,
            viewY(pt.y0) + height / 2
        ];

        var sliceTop = d3.select(this);

        var slicePath = Lib.ensureSingle(sliceTop, 'path', 'surface', function(s) {
            s.style('pointer-events', 'all');
        });

        if(hasTransition) {
            slicePath.transition().attrTween('d', function(pt2) {
                var interp = makeUpdateSliceIntepolator(pt2, isUp, [width, height]);
                return function(t) { return pathSlice(interp(t)); };
            });
        } else {
            slicePath.attr('d', pathSlice);
        }

        sliceTop
            .call(attachFxHandlers, entry, gd, cd, styleOne, constants)
            .call(helpers.setSliceCursor, gd, { isTransitioning: gd._transitioning });

        slicePath.call(styleOne, pt, trace);

        var sliceTextGroup = Lib.ensureSingle(sliceTop, 'g', 'slicetext');
        var sliceText = Lib.ensureSingle(sliceTextGroup, 'text', '', function(s) {
            // prohibit tex interpretation until we can handle
            // tex and regular text together
            s.attr('data-notex', 1);
        });

        var isFront = helpers.isOnTop(pt, trace);

        sliceText.text(pt.data.data.label)
            .classed('slicetext', true)
            .attr('text-anchor', rightToLeft ? 'end' : 'start') // No middle
            .call(Drawing.font, helpers.determineTextFont(trace, pt, fullLayout.font, trace.directory))
            .call(svgTextUtils.convertToTspans, gd);

        pt.textBB = Drawing.bBox(sliceText.node());
        pt.transform = toMoveInsideSlice(
            pt.x0,
            pt.x1,
            pt.y0 + dirDifY,
            pt.y1 + dirDifY,
            pt.textBB,
            {
                isFront: isFront,
                noCenter: true
            }
        );

        if(helpers.isOutsideText(trace, pt)) {
            // consider in/out diff font sizes
            pt.transform.targetY -= (
                helpers.getOutsideTextFontKey('size', trace, pt, fullLayout.font) -
                helpers.getInsideTextFontKey('size', trace, pt, fullLayout.font)
            );
        }

        if(hasTransition) {
            sliceText.transition().attrTween('transform', function(pt2) {
                var interp = makeUpdateTextInterpolar(pt2, isUp, [width, height]);
                return function(t) { return helpers.strTransform(interp(t)); };
            });
        } else {
            sliceText.attr('transform', helpers.strTransform(pt));
        }
    });
};
