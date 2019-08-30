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
var formatSliceLabel = require('../sunburst/format_slice_label');

var isUp = false; // for Descendants

module.exports = function drawDescendants(gd, cd, entry, slices, opts) {
    var width = opts.width;
    var height = opts.height;

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

    // N.B. slice data isn't the calcdata,
    // grab corresponding calcdata item in sliceData[i].data.data
    var sliceData = partition(entry, [width, height], {
        packing: trace.tiling.packing,
        mirror: trace.tiling.mirror,
        offset: trace.tiling.pad,
        padding: trace.marker.pad
    }).descendants();

    // filter out slices that won't show up on graph
    sliceData = sliceData.filter(function(pt) { return pt.depth < trace._maxDepth; });

    slices = slices.data(sliceData, function(pt) { return helpers.getPtId(pt); });

    slices.enter().append('g')
        .classed('slice', true);

    handleSlicesExit(slices, isUp, [width, height], pathSlice);

    slices.order();

    var updateSlices = slices;
    if(hasTransition) {
        updateSlices = updateSlices.transition().each('end', function() {
            // N.B. gd._transitioning is (still) *true* by the time
            // transition updates get here
            var sliceTop = d3.select(this);
            helpers.setSliceCursor(sliceTop, gd, { isTransitioning: false });
        });
    }

    var hasBottom = trace.textposition.indexOf('bottom') !== -1;
    var hasLeft = trace.textposition.indexOf('left') !== -1;

    updateSlices.each(function(pt) {
        var inFront = helpers.isOnTop(pt, trace);

        pt._hoverPos = [
            viewX(pt.x1 - trace.marker.pad.right),
            hasBottom ?
                viewY(inFront ? (pt.y0 + pt.y1) / 2 : pt.y1 - trace.marker.pad.bottom / 2) :
                viewY(inFront ? (pt.y0 + pt.y1) / 2 : pt.y0 + trace.marker.pad.top / 2)
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

        var tx = '';
        if(helpers.isEntry(pt) && trace.directory.visible && trace.directory.position === 'inside') {
            tx = helpers.getDirectoryLabel(entry.data);
        }
        tx = formatSliceLabel(pt, entry, trace, fullLayout, {
            noText: !isFront,
            label: tx
        });

        sliceText.text(tx)
            .classed('slicetext', true)
            .attr('text-anchor', rightToLeft ? 'end' : (hasLeft || !isFront) ? 'start' : 'middle')
            .call(Drawing.font, helpers.determineTextFont(trace, pt, fullLayout.font))
            .call(svgTextUtils.convertToTspans, gd);

        pt.textBB = Drawing.bBox(sliceText.node());
        pt.transform = toMoveInsideSlice(
            pt.x0,
            pt.x1,
            pt.y0,
            pt.y1,
            pt.textBB,
            {
                isFront: isFront,
                noMiddle: !isFront
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
