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
var strTransform = require('./str_transform');

var isUp = true; // for Ancestors

module.exports = function drawAncestors(gd, cd, entry, slices, opts) {
    var width = opts.width;
    var height = opts.height;

    var dirX0 = opts.dirX0;
    var dirY0 = opts.dirY0;
    var dirDifY = opts.dirDifY;

    var limitDirX0 = opts.limitDirX0;
    var limitDirY0 = opts.limitDirY0;
    var limitDirX1 = opts.limitDirX1;
    var limitDirY1 = opts.limitDirY1;

    var rightToLeft = opts.rightToLeft;
    var pathSlice = opts.pathSlice;
    var toMoveInsideSlice = opts.toMoveInsideSlice;

    var hasTransition = opts.hasTransition;

    var makeExitSliceInterpolator = opts.makeExitSliceInterpolator;
    var makeUpdateSliceIntepolator = opts.makeUpdateSliceIntepolator;
    var makeUpdateTextInterpolar = opts.makeUpdateTextInterpolar;

    var fullLayout = gd._fullLayout;
    var cd0 = cd[0];
    var trace = cd0.trace;

    var eachWidth = opts.width / (entry.height + 1);

    var sliceData = partition(entry, [width, height], {
        aspectratio: 1,
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

    slices = slices.data(sliceData, function(pt) { return helpers.getPtId(pt); });

    slices.enter().append('g')
        .classed('directory', true);

    if(hasTransition) {
        slices.exit().transition()
            .each(function() {
                var sliceTop = d3.select(this);

                var slicePath = sliceTop.select('path.surface');
                slicePath.transition().attrTween('d', function(pt2) {
                    var interp = makeExitSliceInterpolator(pt2, isUp, [width, height]);
                    return function(t) { return pathSlice(interp(t)); };
                });

                var sliceTextGroup = sliceTop.select('g.slicetext');
                sliceTextGroup.attr('opacity', 0);
            })
            .remove();
    } else {
        slices.exit().remove();
    }
    slices.order();

    var updateSlices = slices;

    updateSlices.each(function(pt) {
        var sliceTop = d3.select(this);

        var slicePath = Lib.ensureSingle(sliceTop, 'path', 'surface', function(s) {
            s.style('pointer-events', 'all');
        });

        pt._hoverPos = [
            limitDirX0(pt.x0) + dirX0 + eachWidth / 2,
            limitDirY0(pt.y0) + dirY0 + height / 2
        ];

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

        sliceText.text(pt.data.data.label)
            .classed('slicetext', true)
            .attr('text-anchor', rightToLeft ? 'end' : 'start') // No middle
            .call(Drawing.font, helpers.determineTextFont(trace, pt, fullLayout.font, trace.directory))
            .call(svgTextUtils.convertToTspans, gd);

        pt.textBB = Drawing.bBox(sliceText.node());
        pt.transform = toMoveInsideSlice(
            limitDirX0(pt.x0),
            limitDirX1(pt.x1),
            limitDirY0(pt.y0) + dirDifY,
            limitDirY1(pt.y1) + dirDifY,
            pt.textBB, {
                isFront: helpers.isOnTop(pt, trace),
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
                return function(t) { return strTransform(interp(t)); };
            });
        } else {
            sliceText.attr('transform', strTransform(pt));
        }
    });
};
