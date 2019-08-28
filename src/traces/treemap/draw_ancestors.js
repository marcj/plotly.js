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

    var rightText = opts.rightText;
    var pathSlice = opts.pathSlice;
    var toMoveInsideSlice = opts.toMoveInsideSlice;

    var fullLayout = gd._fullLayout;
    var cd0 = cd[0];
    var trace = cd0.trace;

    var eachWidth = opts.width / (entry.height + 1);

    var sliceData = partition(entry, [width, height], {
        aspectratio: 1,
        packing: 'dice',
        mirror: {
            x: rightText,
            y: false,
            xy: false
        },
        offset: 0,
        padding: {
            top: 0,
            left: rightText ? 0 : eachWidth,
            right: rightText ? eachWidth : 0,
            bottom: 0
        }
    }).descendants();

    slices = slices.data(sliceData, function(pt) { return helpers.getPtId(pt); });

    slices.enter().append('g')
        .classed('directory', true);

    slices.exit().remove();

    slices.order();

    var updateSlices = slices;

    updateSlices.each(function(pt) {
        var sliceTop = d3.select(this);

        sliceTop
            .call(attachFxHandlers, entry, gd, cd, styleOne, constants)
            .call(helpers.setSliceCursor, gd, { isTransitioning: gd._transitioning });

        pt._hoverPos = [
            limitDirX0(pt.x0) + dirX0,
            limitDirY0(pt.y0) + dirY0
        ];

        var slicePath = Lib.ensureSingle(sliceTop, 'path', 'directoryrect', function(s) {
            s.style('pointer-events', 'all');
        });

        slicePath.attr('d', pathSlice);

        slicePath.call(styleOne, pt, trace);

        var sliceTextGroup = Lib.ensureSingle(sliceTop, 'g', 'directorytext');
        var sliceText = Lib.ensureSingle(sliceTextGroup, 'text', '', function(s) {
            // prohibit tex interpretation until we can handle
            // tex and regular text together
            s.attr('data-notex', 1);
        });

        sliceText.text(pt.data.data.label)
            .classed('directorytext', true)
            .attr('text-anchor', rightText ? 'end' : 'start') // No middle
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

        sliceText.attr('transform', strTransform(pt));
    });
};
