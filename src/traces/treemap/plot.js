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

var hasTransition = require('../sunburst/helpers').hasTransition;
var helpers = require('../sunburst/helpers');

var Lib = require('../../lib');
var TEXTPAD = require('../bar/constants').TEXTPAD;
var toMoveInsideBar = require('../bar/plot').toMoveInsideBar;

var drawDescendants = require('./draw_descendants');
var drawAncestors = require('./draw_ancestors');

module.exports = function(gd, cdmodule, transitionOpts, makeOnCompleteCallback) {
    var fullLayout = gd._fullLayout;
    var layer = fullLayout._treemaplayer;
    var join, onComplete;

    // If transition config is provided, then it is only a partial replot and traces not
    // updated are removed.
    var isFullReplot = !transitionOpts;

    join = layer.selectAll('g.trace.treemap')
        .data(cdmodule, function(cd) { return cd[0].trace.uid; });

    // using same 'stroke-linejoin' as pie traces
    join.enter().append('g')
        .classed('trace', true)
        .classed('treemap', true)
        .attr('stroke-linejoin', 'round');

    join.order();

    if(hasTransition(transitionOpts)) {
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
    var hasTransition = helpers.hasTransition(transitionOpts);

    // stash of 'previous' position data used by tweening functions
    var prevLookup = {};
    var prevLookdown = {};
    var getPrev = function(pt, isUp) {
        return (isUp) ?
            prevLookup[helpers.getPtId(pt)] :
            prevLookdown[helpers.getPtId(pt)];
    };

    var cd0 = cd[0];
    var trace = cd0.trace;
    var hierarchy = cd0.hierarchy;

    var gs = fullLayout._size;
    var domain = trace.domain;
    var vpw = gs.w * (domain.x[1] - domain.x[0]);
    var vph = gs.h * (domain.y[1] - domain.y[0]);

    var dirEntry;
    var entry = helpers.findEntryWithLevel(hierarchy, trace.level);
    var maxDepth = helpers.getMaxDepth(trace);
    // N.B. handle multiple-root special case
    var mvX = 0;
    var mvY = 0;
    if(cd0.hasMultipleRoots && helpers.isHierarchyRoot(entry)) {
        /*
        mvX = (trace.marker.pad.right - trace.marker.pad.left) / 2;
        mvY = (trace.marker.pad.bottom - trace.marker.pad.top) / 2;

        vpw += trace.marker.pad.right + trace.marker.pad.left;
        vph += trace.marker.pad.bottom + trace.marker.pad.top;
        */
        maxDepth++;
    }
    trace._maxDepth = maxDepth;

    var dirTop;
    var dirRight;
    var dirBottom;
    if(trace.directory.visible) {
        dirTop = trace.directory.position.indexOf('top') !== -1;
        dirRight = trace.directory.position.indexOf('right') !== -1;
        dirBottom = trace.directory.position.indexOf('bottom') !== -1;

        if(dirTop) {
            mvY += trace.directory.height / 2;
            vph -= trace.directory.height;
        } else if(dirBottom) {
            mvY -= trace.directory.height / 2;
            vph -= trace.directory.height;
        }
    }

    var domainMidX = (domain.x[1] + domain.x[0]) / 2;
    var domainMidY = (domain.y[1] + domain.y[0]) / 2;

    var cx = cd0.cx = mvX + gs.l + gs.w * domainMidX;
    var cy = cd0.cy = mvY + gs.t + gs.h * (1 - domainMidY);

    var cenX = cx - vpw / 2;
    var cenY = cy - vph / 2;

    var viewMapX = function(x) { return cenX + x; };
    var viewMapY = function(y) { return cenY + y; };

    var dirW = vpw;
    var dirH = trace.directory.height;
    var dirHalfH = dirH / 2;

    var dirDifX = dirRight ? -dirHalfH : dirHalfH;
    var dirDifY = dirTop ? -dirH : vph;
    var dirY0 = viewMapY(0) + dirDifY;
    var dirX0 = viewMapX(0);

    var viewDirX = function(x) { return dirX0 + x; };
    var viewDirY = function(y) { return dirY0 + y; };

    function pos(x, y) {
        return x + ',' + y;
    }

    // directory path generation fn
    var pathAncestor = function(d) {
        var _x0 = viewDirX(Math.max(Math.min(d.x0, d.x0 - dirDifX), 0));
        var _x1 = viewDirX(Math.min(Math.max(d.x1, d.x1 - dirDifX), dirW));
        var _y0 = viewDirY(d.y0);
        var _y1 = viewDirY(d.y1);

        var _yMid = _y0 + dirHalfH;
        var _xMid;
        if(dirRight) {
            _xMid = (_x1 < dirX0 + dirW) ? _x1 - dirHalfH : _x1;
        } else {
            _xMid = (_x0 > dirX0) ? _x0 + dirHalfH : _x0;
        }

        return (
           'M' + pos(_x0, _y0) +
           'L' + pos(_x1, _y0) +
           (dirRight ? 'L' + pos(_xMid, _yMid) : '') +
           'L' + pos(_x1, _y1) +
           'L' + pos(_x0, _y1) +
           (dirRight ? '' : 'L' + pos(_xMid, _yMid)) +
           'Z'
        );
    };

    // slice path generation fn
    var pathDescendant = function(d) {
        var _x0 = viewMapX(d.x0);
        var _x1 = viewMapX(d.x1);
        var _y0 = viewMapY(d.y0);
        var _y1 = viewMapY(d.y1);

        return (
           'M' + pos(_x0, _y0) +
           'L' + pos(_x1, _y0) +
           'L' + pos(_x1, _y1) +
           'L' + pos(_x0, _y1) + 'Z'
        );
    };

    var getOrigin = function(pt, isUp, size) {
        var width = size[0];
        var height = size[1];

        var x0 = pt.x0;
        var x1 = pt.x1;
        var y0 = pt.y0;
        var y1 = pt.y1;

        var rect = trace._rect || {
            x0: 0,
            x1: width,
            y0: 0,
            y1: height
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
        if(isLeftOfRect()) edgePoints.push({id: 0, x: 0, y: height / 2});
        if(!isUp && isBottomOfRect()) edgePoints.push({id: 1, x: width / 2, y: 0});
        if(isRightOfRect()) edgePoints.push({id: 2, x: width, y: height / 2});
        if(!isUp && isTopOfRect()) edgePoints.push({id: 3, x: width / 2, y: height});

        if(!edgePoints.length) {
            return {
                x0: (midX <= width / 2) ? 0 : width,
                x1: (midX < width / 2) ? 0 : width,
                y0: (midY <= height / 2) ? 0 : height,
                y1: (midY < height / 2) ? 0 : height
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
        if(x0 !== 0 || x1 !== width ||
            y0 !== 0 || y1 !== height
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
            x0: width,
            x1: width,
            y0: y0,
            y1: y1
        } : (q === 3) ? {
            x0: x0,
            x1: x1,
            y0: height,
            y1: height
        } : {
            x0: x0,
            x1: x1,
            y0: y0,
            y1: y1
        };
    };

    var toMoveInsideSlice = function(x0, x1, y0, y1, textBB, opts) {
        var hasFlag = function(f) { return trace.textposition.indexOf(f) !== -1; };

        var hasBottom = hasFlag('bottom');
        var hasTop = hasFlag('top') || !(hasBottom || !opts.noMiddle);

        var anchor =
            hasTop ? 'start' :
            hasBottom ? 'end' : 'middle';

        var hasRight = hasFlag('right');
        var hasLeft = hasFlag('left') || !(hasRight || !opts.noCenter);

        var offsetDir =
            hasLeft ? 'left' :
            hasRight ? 'right' : 'center';

        if(!opts.isFront) {
            x0 += hasLeft ? TEXTPAD : 0;
            x1 -= hasRight ? TEXTPAD : 0;
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

        transform.targetX = viewMapX(transform.targetX);
        transform.targetY = viewMapY(transform.targetY);

        return {
            scale: transform.scale,
            rotate: transform.rotate,
            textX: transform.textX,
            textY: transform.textY,
            targetX: transform.targetX,
            targetY: transform.targetY
        };
    };

    var interpFromParent = function(pt, isUp, size) {
        var parent = pt.parent;
        var parentPrev = getPrev(parent, isUp);

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

        return Lib.extendFlat({}, getOrigin(pt, isUp, size));
    };

    var makeExitSliceInterpolator = function(pt, isUp, size) {
        var prev = getPrev(pt, isUp);

        return d3.interpolate(prev, getOrigin(pt, isUp, size));
    };

    var makeUpdateSliceIntepolator = function(pt, isUp, size) {
        var prev0 = getPrev(pt, isUp);

        var prev = {};
        Lib.extendFlat(prev, getOrigin(pt, isUp, size));

        if(prev0) {
            // if pt already on graph, this is easy
            prev = prev0;
        } else {
            // for new pts:
            if(pt.parent) {
                Lib.extendFlat(prev, interpFromParent(pt, isUp, size));
            }
        }

        return d3.interpolate(prev, {
            x0: pt.x0,
            x1: pt.x1,
            y0: pt.y0,
            y1: pt.y1
        });
    };

    var makeUpdateTextInterpolar = function(pt, isUp, size) {
        var prev0 = getPrev(pt, isUp);
        var prev = {};

        var origin = getOrigin(pt, isUp, size);

        Lib.extendFlat(prev, {
            transform: toMoveInsideSlice(
                origin.x0,
                origin.x1,
                origin.y0,
                origin.y1,
                pt.textBB,
                {
                    isFront: helpers.isOnTop(pt, trace)
                }
            )
        });

        if(prev0) {
            // if pt already on graph, this is easy
            prev = prev0;
        } else {
            // for new pts:
            if(pt.parent) {
                Lib.extendFlat(prev, interpFromParent(pt, isUp, size));
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
    };

    var handleSlicesExit = function(slices, isUp, size, pathSlice) {
        var width = size[0];
        var height = size[1];

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
    };

    var gTrace = d3.select(element);
    var selAncestors = gTrace.selectAll('g.directory');
    var selDescendants = gTrace.selectAll('g.slice');

    if(!entry) {
        return selDescendants.remove();
    }

    if(hasTransition) {
        // Important: do this before binding new sliceData!

        selAncestors.each(function(pt) {
            prevLookup[helpers.getPtId(pt)] = {
                x0: pt.x0,
                x1: pt.x1,
                y0: pt.y0,
                y1: pt.y1,
                transform: pt.transform
            };
        });

        selDescendants.each(function(pt) {
            prevLookdown[helpers.getPtId(pt)] = {
                x0: pt.x0,
                x1: pt.x1,
                y0: pt.y0,
                y1: pt.y1,
                transform: pt.transform
            };
        });
    }

    drawDescendants(gd, cd, entry, selDescendants, {
        width: vpw,
        height: vph,

        viewX: viewMapX,
        viewY: viewMapY,

        rightToLeft: trace.textposition.indexOf('right') !== -1,
        pathSlice: pathDescendant,
        toMoveInsideSlice: toMoveInsideSlice,

        makeUpdateSliceIntepolator: makeUpdateSliceIntepolator,
        makeUpdateTextInterpolar: makeUpdateTextInterpolar,

        handleSlicesExit: handleSlicesExit,

        hasTransition: hasTransition
    });

    if(trace.directory.visible && trace.directory.position !== 'inside') {
        var rawAncestors = entry.data.ancestors();

        var ancestors = [];
        for(var q = 0; q < rawAncestors.length; q++) {
            var raw = rawAncestors[q].data;

            ancestors[q] = {
                id: raw.id,
                pid: raw.pid,
                label: raw.label,
                color: raw.color
            };

            if(raw.hasOwnProperty('v')) {
                ancestors[q].v = raw.v;
            } else {
                ancestors[q].value = raw.value;
            }
        }

        var root;
        try {
            root = d3Hierarchy.stratify()
                .id(function(d) { return d.id; })
                .parentId(function(d) { return d.pid; })(ancestors);
        } catch(e) {
            return Lib.warn('Failed to build directory hierarchy. Error: ' + e.message);
        }

        // create new hierarchy
        dirEntry = d3Hierarchy.hierarchy(root);

        drawAncestors(gd, cd, dirEntry, selAncestors, {
            width: dirW,
            height: dirH,

            dirDifY: dirDifY,

            viewX: viewDirX,
            viewY: viewDirY,

            rightToLeft: dirRight,
            pathSlice: pathAncestor,
            toMoveInsideSlice: toMoveInsideSlice,

            makeUpdateSliceIntepolator: makeUpdateSliceIntepolator,
            makeUpdateTextInterpolar: makeUpdateTextInterpolar,

            handleSlicesExit: handleSlicesExit,

            hasTransition: hasTransition
        });
    }
}
