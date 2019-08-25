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

var helpers = require('./helpers');
var attachFxHandlers = require('./attach_fx_handlers');

var Drawing = require('../../components/drawing');
var Lib = require('../../lib');
var svgTextUtils = require('../../lib/svg_text_utils');
var styleOne = require('./style').styleOne;
var formatPieValue = require('../pie/helpers').formatPieValue;
var transformInsideText = require('../pie/plot').transformInsideText;

module.exports = function(gd, cdmodule, transitionOpts, makeOnCompleteCallback) {
    var fullLayout = gd._fullLayout;
    var layer = fullLayout._sunburstlayer;
    var join, onComplete;

    // If transition config is provided, then it is only a partial replot and traces not
    // updated are removed.
    var isFullReplot = !transitionOpts;
    var hasTransition = transitionOpts && transitionOpts.duration > 0;

    join = layer.selectAll('g.trace.sunburst')
        .data(cdmodule, function(cd) { return cd[0].trace.uid; });

    // using same 'stroke-linejoin' as pie traces
    join.enter().append('g')
        .classed('trace', true)
        .classed('sunburst', true)
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
    // as sunburst has no cross-trace logic!
    var hasTransition = transitionOpts && transitionOpts.duration > 0;

    var gTrace = d3.select(element);
    var slices = gTrace.selectAll('g.slice');

    var cd0 = cd[0];
    var trace = cd0.trace;
    var hierarchy = cd0.hierarchy;
    var entry = helpers.findEntryWithLevel(hierarchy, trace.level);
    var maxDepth = helpers.getMaxDepth(trace);

    var gs = fullLayout._size;
    var domain = trace.domain;
    var vpw = gs.w * (domain.x[1] - domain.x[0]);
    var vph = gs.h * (domain.y[1] - domain.y[0]);
    var rMax = 0.5 * Math.min(vpw, vph);
    var cx = cd0.cx = gs.l + gs.w * (domain.x[1] + domain.x[0]) / 2;
    var cy = cd0.cy = gs.t + gs.h * (1 - domain.y[0]) - vph / 2;

    if(!entry) {
        return slices.remove();
    }

    // previous root 'pt' (can be empty)
    var prevEntry = null;
    // stash of 'previous' position data used by tweening functions
    var prevLookup = {};

    if(hasTransition) {
        // Important: do this before binding new sliceData!
        slices.each(function(pt) {
            prevLookup[helpers.getPtId(pt)] = {
                rpx0: pt.rpx0,
                rpx1: pt.rpx1,
                x0: pt.x0,
                x1: pt.x1,
                transform: pt.transform
            };

            if(!prevEntry && helpers.isEntry(pt)) {
                prevEntry = pt;
            }
        });
    }

    // N.B. slice data isn't the calcdata,
    // grab corresponding calcdata item in sliceData[i].data.data
    var sliceData = partition(entry).descendants();

    var maxHeight = entry.height + 1;
    var yOffset = 0;
    var cutoff = maxDepth;
    // N.B. handle multiple-root special case
    if(cd0.hasMultipleRoots && helpers.isHierachyRoot(entry)) {
        sliceData = sliceData.slice(1);
        maxHeight -= 1;
        yOffset = 1;
        cutoff += 1;
    }

    // filter out slices that won't show up on graph
    sliceData = sliceData.filter(function(pt) { return pt.y1 <= cutoff; });

    // partition span ('y') to sector radial px value
    var maxY = Math.min(maxHeight, maxDepth);
    var y2rpx = function(y) { return (y - yOffset) / maxY * rMax; };
    // (radial px value, partition angle ('x'))  to px [x,y]
    var rx2px = function(r, x) { return [r * Math.cos(x), -r * Math.sin(x)]; };
    // slice path generation fn
    var pathSlice = function(d) { return Lib.pathAnnulus(d.rpx0, d.rpx1, d.x0, d.x1, cx, cy); };
    // slice text translate x/y
    var transTextX = function(d) { return cx + d.pxmid[0] * d.transform.rCenter + (d.transform.x || 0); };
    var transTextY = function(d) { return cy + d.pxmid[1] * d.transform.rCenter + (d.transform.y || 0); };

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

    // next x1 (i.e. sector end angle) of previous entry
    var nextX1ofPrevEntry = null;
    if(hasTransition && prevEntry) {
        var prevEntryId = helpers.getPtId(prevEntry);
        slices.each(function(pt) {
            if(nextX1ofPrevEntry === null && (helpers.getPtId(pt) === prevEntryId)) {
                nextX1ofPrevEntry = pt.x1;
            }
        });
    }

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

        pt.rpx0 = y2rpx(pt.y0);
        pt.rpx1 = y2rpx(pt.y1);
        pt.xmid = (pt.x0 + pt.x1) / 2;
        pt.pxmid = rx2px(pt.rpx1, pt.xmid);
        pt.midangle = -(pt.xmid - Math.PI / 2);
        pt.halfangle = 0.5 * Math.min(Lib.angleDelta(pt.x0, pt.x1) || Math.PI, Math.PI);
        pt.ring = 1 - (pt.rpx0 / pt.rpx1);
        pt.rInscribed = getInscribedRadiusFraction(pt, trace);

        if(hasTransition) {
            slicePath.transition().attrTween('d', function(pt2) {
                var interp = makeUpdateSliceIntepolator(pt2);
                return function(t) { return pathSlice(interp(t)); };
            });
        } else {
            slicePath.attr('d', pathSlice);
        }

        sliceTop
            .call(attachFxHandlers, entry, gd, cd, styleOne)
            .call(helpers.setSliceCursor, gd, {isTransitioning: gd._transitioning});

        slicePath.call(styleOne, pt, trace);

        var sliceTextGroup = Lib.ensureSingle(sliceTop, 'g', 'slicetext');
        var sliceText = Lib.ensureSingle(sliceTextGroup, 'text', '', function(s) {
            // prohibit tex interpretation until we can handle
            // tex and regular text together
            s.attr('data-notex', 1);
        });

        sliceText.text(formatSliceLabel(pt, entry, trace, fullLayout))
            .classed('slicetext', true)
            .attr('text-anchor', 'middle')
            .call(Drawing.font, helpers.determineTextFont(trace, pt, fullLayout.font))
            .call(svgTextUtils.convertToTspans, gd);

        // position the text relative to the slice
        var textBB = Drawing.bBox(sliceText.node());
        pt.transform = transformInsideText(textBB, pt, cd0, styleOne);
        pt.translateX = transTextX(pt);
        pt.translateY = transTextY(pt);

        var strTransform = function(d, textBB) {
            return 'translate(' + d.translateX + ',' + d.translateY + ')' +
                (d.transform.scale < 1 ? ('scale(' + d.transform.scale + ')') : '') +
                (d.transform.rotate ? ('rotate(' + d.transform.rotate + ')') : '') +
                'translate(' +
                    (-(textBB.left + textBB.right) / 2) + ',' +
                    (-(textBB.top + textBB.bottom) / 2) +
                ')';
        };

        if(hasTransition) {
            sliceText.transition().attrTween('transform', function(pt2) {
                var interp = makeUpdateTextInterpolar(pt2);
                return function(t) { return strTransform(interp(t), textBB); };
            });
        } else {
            sliceText.attr('transform', strTransform(pt, textBB));
        }
    });

    function makeExitSliceInterpolator(pt) {
        var id = helpers.getPtId(pt);
        var prev = prevLookup[id];
        var entryPrev = prevLookup[helpers.getPtId(entry)];
        var next;

        if(entryPrev) {
            var a = pt.x1 > entryPrev.x1 ? 2 * Math.PI : 0;
            // if pt to remove:
            // - if 'below' where the root-node used to be: shrink it radially inward
            // - otherwise, collapse it clockwise or counterclockwise which ever is shortest to theta=0
            next = pt.rpx1 < entryPrev.rpx1 ? {rpx0: 0, rpx1: 0} : {x0: a, x1: a};
        } else {
            // this happens when maxdepth is set, when leaves must
            // be removed and the rootPt is new (i.e. does not have a 'prev' object)
            var parent;
            var parentId = helpers.getPtId(pt.parent);
            slices.each(function(pt2) {
                if(helpers.getPtId(pt2) === parentId) {
                    return parent = pt2;
                }
            });
            var parentChildren = parent.children;
            var ci;
            parentChildren.forEach(function(pt2, i) {
                if(helpers.getPtId(pt2) === id) {
                    return ci = i;
                }
            });
            var n = parentChildren.length;
            var interp = d3.interpolate(parent.x0, parent.x1);
            next = {
                rpx0: rMax, rpx1: rMax,
                x0: interp(ci / n), x1: interp((ci + 1) / n)
            };
        }

        return d3.interpolate(prev, next);
    }

    function makeUpdateSliceIntepolator(pt) {
        var prev0 = prevLookup[helpers.getPtId(pt)];
        var prev;
        var next = {x0: pt.x0, x1: pt.x1, rpx0: pt.rpx0, rpx1: pt.rpx1};

        if(prev0) {
            // if pt already on graph, this is easy
            prev = prev0;
        } else {
            // for new pts:
            if(prevEntry) {
                // if trace was visible before
                if(pt.parent) {
                    if(nextX1ofPrevEntry) {
                        // if new branch, twist it in clockwise or
                        // counterclockwise which ever is shorter to
                        // its final angle
                        var a = pt.x1 > nextX1ofPrevEntry ? 2 * Math.PI : 0;
                        prev = {x0: a, x1: a};
                    } else {
                        // if new leaf (when maxdepth is set),
                        // grow it radially and angularly from
                        // its parent node
                        prev = {rpx0: rMax, rpx1: rMax};
                        Lib.extendFlat(prev, interpX0X1FromParent(pt));
                    }
                } else {
                    // if new root-node, grow it radially
                    prev = {rpx0: 0, rpx1: 0};
                }
            } else {
                // start sector of new traces from theta=0
                prev = {x0: 0, x1: 0};
            }
        }

        return d3.interpolate(prev, next);
    }

    function makeUpdateTextInterpolar(pt) {
        var prev0 = prevLookup[helpers.getPtId(pt)];
        var prev;
        var transform = pt.transform;

        if(prev0) {
            prev = prev0;
        } else {
            prev = {
                rpx1: pt.rpx1,
                transform: {
                    scale: 0,
                    rotate: transform.rotate,
                    rCenter: transform.rCenter,
                    x: transform.x,
                    y: transform.y
                }
            };

            // for new pts:
            if(prevEntry) {
                // if trace was visible before
                if(pt.parent) {
                    if(nextX1ofPrevEntry) {
                        // if new branch, twist it in clockwise or
                        // counterclockwise which ever is shorter to
                        // its final angle
                        var a = pt.x1 > nextX1ofPrevEntry ? 2 * Math.PI : 0;
                        prev.x0 = prev.x1 = a;
                    } else {
                        // if leaf
                        Lib.extendFlat(prev, interpX0X1FromParent(pt));
                    }
                } else {
                    // if new root-node
                    prev.x0 = prev.x1 = 0;
                }
            } else {
                // on new traces
                prev.x0 = prev.x1 = 0;
            }
        }

        var rpx1Fn = d3.interpolate(prev.rpx1, pt.rpx1);
        var x0Fn = d3.interpolate(prev.x0, pt.x0);
        var x1Fn = d3.interpolate(prev.x1, pt.x1);
        var scaleFn = d3.interpolate(prev.transform.scale, transform.scale);
        var rotateFn = d3.interpolate(prev.transform.rotate, transform.rotate);

        // smooth out start/end from entry, to try to keep text inside sector
        // while keeping transition smooth
        var pow = transform.rCenter === 0 ? 3 :
            prev.transform.rCenter === 0 ? 1 / 3 :
            1;
        var _rCenterFn = d3.interpolate(prev.transform.rCenter, transform.rCenter);
        var rCenterFn = function(t) { return _rCenterFn(Math.pow(t, pow)); };

        return function(t) {
            var rpx1 = rpx1Fn(t);
            var x0 = x0Fn(t);
            var x1 = x1Fn(t);
            var rCenter = rCenterFn(t);

            var d = {
                pxmid: rx2px(rpx1, (x0 + x1) / 2),
                transform: {
                    rCenter: rCenter,
                    x: transform.x,
                    y: transform.y
                }
            };

            var out = {
                rpx1: rpx1Fn(t),
                translateX: transTextX(d),
                translateY: transTextY(d),
                transform: {
                    scale: scaleFn(t),
                    rotate: rotateFn(t),
                    rCenter: rCenter
                }
            };

            return out;
        };
    }

    function interpX0X1FromParent(pt) {
        var parent = pt.parent;
        var parentPrev = prevLookup[helpers.getPtId(parent)];
        var out = {};

        if(parentPrev) {
            // if parent is visible
            var parentChildren = parent.children;
            var ci = parentChildren.indexOf(pt);
            var n = parentChildren.length;
            var interp = d3.interpolate(parentPrev.x0, parentPrev.x1);
            out.x0 = interp(ci / n);
            out.x1 = interp(ci / n);
        } else {
            // w/o visible parent
            // TODO !!! HOW ???
            out.x0 = out.x1 = 0;
        }

        return out;
    }
}

// x[0-1] keys are angles [radians]
// y[0-1] keys are hierarchy heights [integers]
function partition(entry) {
    return d3Hierarchy.partition()
        .size([2 * Math.PI, entry.height + 1])(entry);
}

function formatSliceLabel(pt, entry, trace, fullLayout) {
    var textinfo = trace.textinfo;

    if(!textinfo || textinfo === 'none') {
        return '';
    }

    var cdi = pt.data.data;
    var separators = fullLayout.separators;
    var parts = textinfo.split('+');
    var hasFlag = function(flag) { return parts.indexOf(flag) !== -1; };
    var thisText = [];
    var tx;

    if(hasFlag('label') && cdi.label) thisText.push(cdi.label);

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
                if(hasMultiplePercents) tx += ' of ' + key + ' ';
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

    return thisText.join('<br>');
}

function getInscribedRadiusFraction(pt) {
    if(pt.rpx0 === 0 && Lib.isFullCircle([pt.x0, pt.x1])) {
        // special case of 100% with no hole
        return 1;
    } else {
        return Math.max(0, Math.min(
            1 / (1 + 1 / Math.sin(pt.halfangle)),
            pt.ring / 2
        ));
    }
}
