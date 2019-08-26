/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3 = require('d3');
var d3Hierarchy = require('d3-hierarchy');

var helpers = require('../sunburst/helpers');
var constants = require('./constants');
var attachFxHandlers = require('../sunburst/attach_fx_handlers');

var Drawing = require('../../components/drawing');
var Lib = require('../../lib');
var svgTextUtils = require('../../lib/svg_text_utils');
var styleOne = require('./style').styleOne;
var formatPieValue = require('../pie/helpers').formatPieValue;
var TEXTPAD = require('../bar/constants').TEXTPAD;
var barPlot = require('../bar/plot');
var toMoveInsideBar = barPlot.toMoveInsideBar;
var getTransform = barPlot.getTransform;

module.exports = function(gd, cdmodule, transitionOpts, makeOnCompleteCallback) {
    var fullLayout = gd._fullLayout;
    var layer = fullLayout._treemaplayer;
    var join, onComplete;

    // If transition config is provided, then it is only a partial replot and traces not
    // updated are removed.
    var isFullReplot = !transitionOpts;
    var hasTransition = transitionOpts && transitionOpts.duration > 0;

    join = layer.selectAll('g.trace.treemap')
        .data(cdmodule, function(cd) { return cd[0].trace.uid; });

    // using same 'stroke-linejoin' as pie traces
    join.enter().append('g')
        .classed('trace', true)
        .classed('treemap', true)
        .attr('stroke-linejoin', 'round');

    join.order();

    if(hasTransition) {
        if(makeOnCompleteCallback) {
            // If it was passed a callback to register completion, make a callback. If
            // this is created, then it must be executed on completion, otherwise the
            // pos-transition redraw will not execute:
            onComplete = makeOnCompleteCallback();
        }

        var transition = d3.transition()
            .duration(transitionOpts.duration)
            .ease(transitionOpts.easing)
            .each('end', function() { onComplete && onComplete(); })
            .each('interrupt', function() { onComplete && onComplete(); });

        transition.each(function() {
            // Must run the selection again since otherwise enters/updates get grouped together
            // and these get executed out of order. Except we need them in order!
            layer.selectAll('g.trace').each(function(cd) {
                plotOne(gd, cd, this, transitionOpts);
            });
        });
    } else {
        join.each(function(cd) {
            plotOne(gd, cd, this, transitionOpts);
        });
    }

    if(isFullReplot) {
        join.exit().remove();
    }
};

function plotOne(gd, cd, element, transitionOpts) {
    var fullLayout = gd._fullLayout;
    // We could optimize hasTransition per trace,
    // as treemap has no cross-trace logic!
    var hasTransition = transitionOpts && transitionOpts.duration > 0;

    var gTrace = d3.select(element);
    var slices = gTrace.selectAll('g.slice');

    var cd0 = cd[0];
    var trace = cd0.trace;

    var gs = fullLayout._size;
    var domain = trace.domain;
    var vpw = gs.w * (domain.x[1] - domain.x[0]);
    var vph = gs.h * (domain.y[1] - domain.y[0]);

    var hierarchy = cd0.hierarchy;
    var entry = helpers.findEntryWithLevel(hierarchy, trace.level);
    var maxDepth = helpers.getMaxDepth(trace);
    // N.B. handle multiple-root special case
    var mvX = 0;
    var mvY = 0;
    if(cd0.hasMultipleRoots && helpers.isHierachyRoot(entry)) {
        mvX = (trace.marker.pad.right - trace.marker.pad.left) / 2;
        mvY = (trace.marker.pad.bottom - trace.marker.pad.top) / 2;

        vpw += trace.marker.pad.right + trace.marker.pad.left;
        vph += trace.marker.pad.bottom + trace.marker.pad.top;

        maxDepth++;
    }
    trace._maxDepth = maxDepth;

    if(trace.directory.visible) {
        if(trace.directory.position === 'top') {
            mvY += trace.directory.height / 2;
            vph -= trace.directory.height;
        } else if(trace.directory.position === 'bottom') {
            mvY -= trace.directory.height / 2;
            vph -= trace.directory.height;
        }
    }

    var domainMidX = (domain.x[1] + domain.x[0]) / 2;
    var domainMidY = (domain.y[1] + domain.y[0]) / 2;

    var cx = cd0.cx = mvX + gs.l + gs.w * domainMidX;
    var cy = cd0.cy = mvY + gs.t + gs.h * (1 - domainMidY);

    var limitX = function(x) { return Math.max(0, Math.min(vpw, x)); };
    var limitY = function(y) { return Math.max(0, Math.min(vph, y)); };

    var viewportX = function(x) { return limitX(x) + cx - vpw / 2; };
    var viewportY = function(y) { return limitY(y) + cy - vph / 2; };

    var getOrigin = function(pt) {
        var x0 = pt.x0;
        var x1 = pt.x1;
        var y0 = pt.y0;
        var y1 = pt.y1;

        var rect = trace._rect || {
            x0: 0,
            x1: vpw,
            y0: 0,
            y1: vph
        };

        var isLeftOfRect = function() {
            return !(
                rect.x0 < x0 ||
                rect.x0 < x1
            );
        };

        var isRightOfRect = function() {
            return !(
                rect.x1 > x0 ||
                rect.x1 > x1
            );
        };

        var isBottomOfRect = function() {
            return !(
                rect.y0 < y0 ||
                rect.y0 < y1
            );
        };

        var isTopOfRect = function() {
            return !(
                rect.y1 > y0 ||
                rect.y1 > y1
            );
        };

        var midX = (x0 + x1) / 2;
        var midY = (y0 + y1) / 2;
        var calcDist = function(x, y) {
            return Math.sqrt(
                Math.pow(x - midX, 2) +
                Math.pow(y - midY, 2)
            );
        };

        var edgePoints = [];
        if(isLeftOfRect()) edgePoints.push({id: 0, x: 0, y: vph / 2});
        if(isBottomOfRect()) edgePoints.push({id: 1, x: vpw / 2, y: 0});
        if(isRightOfRect()) edgePoints.push({id: 2, x: vpw, y: vph / 2});
        if(isTopOfRect()) edgePoints.push({id: 3, x: vpw / 2, y: vph});

        if(!edgePoints.length) {
            return {
                x0: (midX <= vpw / 2) ? 0 : vpw,
                x1: (midX < vpw / 2) ? 0 : vpw,
                y0: (midY <= vph / 2) ? 0 : vph,
                y1: (midY < vph / 2) ? 0 : vph
            };
        }

        var i;
        var dists = [];
        for(i = 0; i < edgePoints.length; i++) {
            dists.push(calcDist(
                edgePoints[i].x,
                edgePoints[i].y
            ));
        }

        var minDist = Infinity;
        var q = -1;
        if(x0 !== 0 || x1 !== vpw ||
            y0 !== 0 || y1 !== vph
        ) {
            for(i = 0; i < edgePoints.length; i++) {
                if(minDist > dists[i]) {
                    minDist = dists[i];
                    q = edgePoints[i].id;
                }
            }
        }

        return (q === 0) ? {
            x0: 0,
            x1: 0,
            y0: y0,
            y1: y1
        } : (q === 1) ? {
            x0: x0,
            x1: x1,
            y0: 0,
            y1: 0
        } : (q === 2) ? {
            x0: vpw,
            x1: vpw,
            y0: y0,
            y1: y1
        } : (q === 3) ? {
            x0: x0,
            x1: x1,
            y0: vph,
            y1: vph
        } : {
            x0: x0,
            x1: x1,
            y0: y0,
            y1: y1
        };
    };

    if(!entry) {
        return slices.remove();
    }

    // stash of 'previous' position data used by tweening functions
    var prevLookup = {};

    if(hasTransition) {
        // Important: do this before binding new sliceData!
        slices.each(function(pt) {
            prevLookup[helpers.getPtId(pt)] = {
                x0: pt.x0,
                x1: pt.x1,
                y0: pt.y0,
                y1: pt.y1,
                transform: pt.transform
            };
        });
    }

    // N.B. slice data isn't the calcdata,
    // grab corresponding calcdata item in sliceData[i].data.data
    var sliceData = partition(entry, [vpw, vph], {
        aspectratio: trace.tiling.aspectratio,
        packing: trace.tiling.packing,
        mirror: trace.tiling.mirror,
        offset: trace.tiling.pad,
        padding: trace.marker.pad
    }).descendants();

    // filter out slices that won't show up on graph
    sliceData = sliceData.filter(function(pt) { return pt.depth < maxDepth; });

    function toMoveInsideSlice(x0, x1, y0, y1, textBB, isInFront) {
        var hasFlag = function(f) { return trace.textposition.indexOf(f) !== -1; };

        var anchor =
            hasFlag('top') ? 'start' :
            hasFlag('bottom') ? 'end' : 'middle';

        var offsetDir =
            hasFlag('left') ? 'left' :
            hasFlag('right') ? 'right' : 'center';

        if(!isInFront) {
            x0 += hasFlag('left') ? TEXTPAD : 0;
            x1 -= hasFlag('right') ? TEXTPAD : 0;
        }

        // position the text relative to the slice
        var transform = toMoveInsideBar(x0, x1, y0, y1, textBB, {
            isHorizontal: false,
            constrained: true,
            angle: 0,
            anchor: anchor
        });

        if(offsetDir !== 'center') {
            var deltaX = (x1 - x0) / 2 - transform.scale * (textBB.right - textBB.left) / 2;

            if(offsetDir === 'left') transform.targetX -= deltaX - TEXTPAD;
            else if(offsetDir === 'right') transform.targetX += deltaX - TEXTPAD;
        }

        return {
            scale: transform.scale,
            rotate: transform.rotate,
            textX: transform.textX,
            textY: transform.textY,
            targetX: viewportX(transform.targetX),
            targetY: viewportY(transform.targetY)
        };
    }

    // slice path generation fn
    var pathSlice = function(d) {
        var _x0 = viewportX(d.x0);
        var _x1 = viewportX(d.x1);
        var _y0 = viewportY(d.y0);
        var _y1 = viewportY(d.y1);

        return (
           'M' + _x0 + ',' + _y0 +
           'L' + _x1 + ',' + _y0 +
           'L' + _x1 + ',' + _y1 +
           'L' + _x0 + ',' + _y1 + 'Z'
        );
    };

    slices = slices.data(sliceData, function(pt) { return helpers.getPtId(pt); });

    slices.enter().append('g')
        .classed('slice', true);

    if(hasTransition) {
        slices.exit().transition()
            .each(function() {
                var sliceTop = d3.select(this);

                var slicePath = sliceTop.select('path.surface');
                slicePath.transition().attrTween('d', function(pt2) {
                    var interp = makeExitSliceInterpolator(pt2);
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
            // transition updates get hare
            var sliceTop = d3.select(this);
            helpers.setSliceCursor(sliceTop, gd, {isTransitioning: false});
        });
    }

    updateSlices.each(function(pt) {
        var sliceTop = d3.select(this);

        var slicePath = Lib.ensureSingle(sliceTop, 'path', 'surface', function(s) {
            s.style('pointer-events', 'all');
        });

        pt._hoverPos = [
            viewportX(pt.x1),
            viewportY(isOnTop(pt, trace) ?
                (pt.y0 + pt.y1) / 2 :
                pt.y0
            )
        ];

        if(hasTransition) {
            slicePath.transition().attrTween('d', function(pt2) {
                var interp = makeUpdateSliceIntepolator(pt2);
                return function(t) { return pathSlice(interp(t)); };
            });
        } else {
            slicePath.attr('d', pathSlice);
        }

        sliceTop
            .call(attachFxHandlers, entry, gd, cd, styleOne, constants)
            .call(helpers.setSliceCursor, gd, {isTransitioning: gd._transitioning});

        slicePath.call(styleOne, pt, trace);

        var sliceTextGroup = Lib.ensureSingle(sliceTop, 'g', 'slicetext');
        var sliceText = Lib.ensureSingle(sliceTextGroup, 'text', '', function(s) {
            // prohibit tex interpretation until we can handle
            // tex and regular text together
            s.attr('data-notex', 1);
        });

        var tx = '';
        if((pt.parent === '' || pt.parent === null) && trace.directory.visible && trace.directory.position === 'inside') {
            tx = helpers.getDirectory(entry.data);
        }
        tx = formatSliceLabel(pt, entry, trace, fullLayout, {
            label: tx
        });

        sliceText.text(tx)
            .classed('slicetext', true)
            .attr('text-anchor',
                trace.textposition.indexOf('left') !== -1 ? 'start' :
                trace.textposition.indexOf('right') !== -1 ? 'end' :
                'middle'
            )
            .call(Drawing.font, helpers.determineTextFont(trace, pt, fullLayout.font))
            .call(svgTextUtils.convertToTspans, gd);

        pt.textBB = Drawing.bBox(sliceText.node());
        pt.transform = toMoveInsideSlice(pt.x0, pt.x1, pt.y0, pt.y1, pt.textBB, isOnTop(pt, trace));

        if(helpers.isOutsideText(trace, pt)) {
            // consider in/out diff font sizes
            pt.transform.targetY -= (
                helpers.getOutsideTextFontKey('size', trace, pt, fullLayout.font) -
                helpers.getInsideTextFontKey('size', trace, pt, fullLayout.font)
            );
        }

        var strTransform = function(d) {
            return getTransform({
                textX: d.transform.textX,
                textY: d.transform.textY,
                targetX: d.transform.targetX,
                targetY: d.transform.targetY,
                scale: d.transform.scale,
                rotate: d.transform.rotate
            });
        };

        if(hasTransition) {
            sliceText.transition().attrTween('transform', function(pt2) {
                var interp = makeUpdateTextInterpolar(pt2);
                return function(t) { return strTransform(interp(t)); };
            });
        } else {
            sliceText.attr('transform', strTransform(pt));
        }
    });

    function makeExitSliceInterpolator(pt) {
        var prev = prevLookup[helpers.getPtId(pt)];

        return d3.interpolate(prev, getOrigin(pt));
    }

    function makeUpdateSliceIntepolator(pt) {
        var prev0 = prevLookup[helpers.getPtId(pt)];

        var prev = {};
        Lib.extendFlat(prev, getOrigin(pt));

        if(prev0) {
            // if pt already on graph, this is easy
            prev = prev0;
        } else {
            // for new pts:
            if(pt.parent) {
                Lib.extendFlat(prev, interpFromParent(pt));
            }
        }

        return d3.interpolate(prev, {
            x0: pt.x0,
            x1: pt.x1,
            y0: pt.y0,
            y1: pt.y1
        });
    }

    function makeUpdateTextInterpolar(pt) {
        var prev0 = prevLookup[helpers.getPtId(pt)];
        var prev = {};

        var origin = getOrigin(pt);

        Lib.extendFlat(prev, {
            transform: toMoveInsideSlice(origin.x0, origin.x1, origin.y0, origin.y1, pt.textBB, isOnTop(pt, trace))
        });

        if(prev0) {
            // if pt already on graph, this is easy
            prev = prev0;
        } else {
            // for new pts:
            if(pt.parent) {
                Lib.extendFlat(prev, interpFromParent(pt));
            }
        }

        return d3.interpolate(prev, {
            transform: {
                scale: pt.transform.scale,
                rotate: pt.transform.rotate,
                textX: pt.transform.textX,
                textY: pt.transform.textY,
                targetX: pt.transform.targetX,
                targetY: pt.transform.targetY
            }
        });
    }

    function interpFromParent(pt) {
        var parent = pt.parent;
        var parentPrev = prevLookup[helpers.getPtId(parent)];

        if(parentPrev) {
            // if parent is visible
            var parentChildren = parent.children;
            var ci = parentChildren.indexOf(pt);
            var n = parentChildren.length;

            var t = ci / n;
            var q0 = parentPrev;
            var q1 = pt;
            return {
                x0: d3.interpolate(q0.x0, q1.x0)(t),
                x1: d3.interpolate(q0.x1, q1.x1)(t),
                y0: d3.interpolate(q0.y0, q1.y0)(t),
                y1: d3.interpolate(q0.y1, q1.y1)(t),
                transform: {
                    scale: d3.interpolate(q0.transform.scale, q1.transform.scale)(t),
                    rotate: d3.interpolate(q0.transform.rotate, q1.transform.rotate)(t),
                    textX: d3.interpolate(q0.transform.textX, q1.transform.textX)(t),
                    textY: d3.interpolate(q0.transform.textY, q1.transform.textY)(t),
                    targetX: d3.interpolate(q0.transform.targetX, q1.transform.targetX)(t),
                    targetY: d3.interpolate(q0.transform.targetY, q1.transform.targetY)(t)
                }
            };
        }

        return Lib.extendFlat({}, getOrigin(pt));
    }

    var dirGroup = Lib.ensureSingle(d3.select(element), 'g', 'directory');
    if(trace.directory.visible && trace.directory.position !== 'inside') {
        var barW = vpw;
        var barH = trace.directory.height;
        var barX = viewportX(0);
        var barY = (trace.directory.position === 'top') ? viewportY(0) - barH : viewportY(vph);

        dirGroup.append('rect')
            .attr('x', barX)
            .attr('y', barY)
            .attr('width', barW)
            .attr('height', barH)
            .style('fill', trace.directory.color)
            .on('click', function() { alert('Clicked!'); });

        dirGroup.append('text')
            .text(helpers.getDirectory(entry.data))
            .attr('text-anchor', 'left')
            .attr('dy', '.75em')
            .attr('x', 2 + barX)
            .attr('y', 2 + barY)
            .call(Drawing.font, {
                size: trace.directory.textfont.size,
                color: trace.directory.textfont.color,
                family: trace.directory.textfont.family
            })
            .call(svgTextUtils.convertToTspans, gd);
    }
}

function getTilingMethod(key) {
    var method;
    switch(key) {
        case 'squarify':
            method = d3Hierarchy.treemapSquarify;
            break;
        case 'binary':
            method = d3Hierarchy.treemapBinary;
            break;
        case 'dice':
            method = d3Hierarchy.treemapDice;
            break;
        case 'slice':
            method = d3Hierarchy.treemapSlice;
            break;
        default: // i.e. 'slice-dice'
            method = d3Hierarchy.treemapSliceDice;
    }

    return method;
}

// x[0-1] keys are hierarchy heights [integers]
// y[0-1] keys are hierarchy heights [integers]
function partition(entry, size, opts) {
    var aspectratio = opts.aspectratio;

    var flipX = opts.mirror.x;
    var flipY = opts.mirror.y;
    var swapXY = opts.mirror.xy;

    var top = opts.padding[flipY ? 'bottom' : 'top'];
    var left = opts.padding[flipX ? 'right' : 'left'];
    var right = opts.padding[flipX ? 'left' : 'right'];
    var bottom = opts.padding[flipY ? 'top' : 'bottom'];

    var tmp;
    if(swapXY) {
        tmp = left;
        left = top;
        top = tmp;

        tmp = right;
        right = bottom;
        bottom = tmp;
    }

    var result = d3Hierarchy
        .treemap()
        .tile(getTilingMethod(opts.packing))
        .paddingInner(opts.offset)
        .paddingLeft(left)
        .paddingRight(right)
        .paddingTop(top / aspectratio)
        .paddingBottom(bottom / aspectratio)
        .size([
            size[swapXY ? 1 : 0],
            size[swapXY ? 0 : 1] / aspectratio]
        )(entry);

    scaleTree(result, 1, aspectratio);
    if(swapXY || flipX || flipY) {
        flipTree(result, size, {
            swapXY: swapXY,
            flipX: flipX,
            flipY: flipY
        });
    }
    return result;
}

function scaleTree(node, scaleX, scaleY) {
    node.x0 *= scaleX;
    node.x1 *= scaleX;
    node.y0 *= scaleY;
    node.y1 *= scaleY;

    var children = node['child' + 'ren'];
    if(children) {
        for(var i = 0; i < children.length; i++) {
            scaleTree(children[i], scaleX, scaleY);
        }
    }
}

function flipTree(node, size, opts) {
    var tmp;

    if(opts.swapXY) {
        // swap x0 and y0
        tmp = node.x0;
        node.x0 = node.y0;
        node.y0 = tmp;

        // swap x1 and y1
        tmp = node.x1;
        node.x1 = node.y1;
        node.y1 = tmp;
    }

    if(opts.flipX) {
        tmp = node.x0;
        node.x0 = size[0] - node.x1;
        node.x1 = size[0] - tmp;
    }

    if(opts.flipY) {
        tmp = node.y0;
        node.y0 = size[1] - node.y1;
        node.y1 = size[1] - tmp;
    }

    var children = node['child' + 'ren'];
    if(children) {
        for(var i = 0; i < children.length; i++) {
            flipTree(children[i], size, opts);
        }
    }
}

function isOnTop(pt, trace) {
    return helpers.isLeaf(pt) || pt.depth === trace._maxDepth - 1;
}

function formatSliceLabel(pt, entry, trace, fullLayout, opts) { // TODO: merge this & sunburst version into one function when texttemplate is merged
    var texttemplate = trace.texttemplate;
    var textinfo = trace.textinfo;

    if(!texttemplate && (!textinfo || textinfo === 'none')) {
        return '';
    }

    var cdi = pt.data.data;
    var separators = fullLayout.separators;
    if(!texttemplate) {
        var isInFront = isOnTop(pt, trace);

        var parts = textinfo.split('+');
        var hasFlag = function(flag) { return parts.indexOf(flag) !== -1; };
        var thisText = [];
        var tx;

        if(hasFlag('label') && cdi.label) {
            thisText.push(opts.label || cdi.label);
        }

        var hasV = cdi.hasOwnProperty('v');

        if(hasFlag('value')) {
            thisText.push(formatPieValue(hasV ? cdi.v : cdi.value, separators));
        }

        var nPercent = 0;
        if(hasFlag('percent parent')) nPercent++;
        if(hasFlag('percent total')) nPercent++;
        var hasMultiplePercents = nPercent > 1;

        if(nPercent) {
            var percent;
            var addPercent = function(key) {
                tx = Lib.formatPercent(percent, 0);
                if(tx === '0%') tx = Lib.formatPercent(percent, 1);
                if(tx !== '0.0%') {
                    if(hasMultiplePercents && isInFront) tx += ' of ' + key + ' ';
                    thisText.push(tx);
                }
            };

            var ref;
            var calcPercent = function(key) {
                percent = (hasV) ? cdi.v / ref.v : cdi.value / ref.value;
                addPercent(key);
            };

            if(hasFlag('percent parent') && pt.parent) {
                ref = pt.parent.data.data;
                calcPercent('parent');
            }
            if(hasFlag('percent total') && pt.parent) {
                ref = entry.data.data;
                calcPercent('total');
            }
        }

        if(hasFlag('text')) {
            tx = Lib.castOption(trace, cdi.i, 'text');
            if(Lib.isValidTextValue(tx)) thisText.push(tx);
        }

        var divider = isInFront ? '<br>' : ' | ';
        return thisText.join(divider);
    }

    var txt = Lib.castOption(trace, cdi.i, 'texttemplate');
    if(!txt) return '';
    var obj = {};
    if(cdi.label) obj.label = cdi.label;
    if(cdi.hasOwnProperty('v')) {
        obj.value = cdi.v;
        obj.valueLabel = formatPieValue(cdi.v, separators);
    }
    if(cdi.hasOwnProperty('color')) {
        obj.color = cdi.color;
    }
    var ptTx = Lib.castOption(trace, cdi.i, 'text');
    if(Lib.isValidTextValue(ptTx)) obj.text = ptTx;
    obj.customdata = Lib.castOption(trace, cdi.i, 'customdata');
    return Lib.texttemplateString(txt, obj, fullLayout._d3locale, obj, trace._meta || {});
}
