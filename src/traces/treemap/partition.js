/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3Hierarchy = require('d3-hierarchy');

module.exports = function partition(entry, size, opts) {
    var aspectratio = opts.aspectratio;

    var flipX = opts.mirror.x;
    var flipY = opts.mirror.y;
    var swapXY = opts.mirror.xy;
    if(opts.packing === 'dice-slice') swapXY = !swapXY;

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
        .round(true)
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
};

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
        default: // i.e. 'slice-dice' | 'dice-slice'
            method = d3Hierarchy.treemapSliceDice;
    }

    return method;
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
