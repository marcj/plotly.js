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
var formatSliceLabel = require('./format_slice_label');

var isUp = false; // for Descendants

module.exports = function drawDescendants(gd, cd, entry, slices, opts) {
    var width = opts.width;
    var height = opts.height;

    var sliceViewX = opts.sliceViewX;
    var sliceViewY = opts.sliceViewY;

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

    // N.B. slice data isn't the calcdata,
    // grab corresponding calcdata item in sliceData[i].data.data
    var sliceData = partition(entry, [width, height], {
        aspectratio: trace.tiling.aspectratio,
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
        var sliceTop = d3.select(this);

        var slicePath = Lib.ensureSingle(sliceTop, 'path', 'surface', function(s) {
            s.style('pointer-events', 'all');
        });

        pt._hoverPos = [
            sliceViewX(rightToLeft ?
                pt.x0 + trace.marker.pad.left :
                pt.x1 - trace.marker.pad.right
            ),
            sliceViewY(helpers.isOnTop(pt, trace) ?
                (pt.y0 + pt.y1) / 2 :
                hasBottom ?
                    pt.y1 - trace.marker.pad.bottom / 2 :
                    pt.y0 + trace.marker.pad.top / 2
            )
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
                return function(t) { return strTransform(interp(t)); };
            });
        } else {
            sliceText.attr('transform', strTransform(pt));
        }
    });
};
