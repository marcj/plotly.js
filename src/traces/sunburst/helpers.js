/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Lib = require('../../lib');
var Color = require('../../components/color');
var setCursor = require('../../lib/setcursor');

function has(v) {
    return v || v === 0;
}

exports.isLeaf = function(pt) {
    return !has(pt.children);
};

exports.isEntry = function(pt) {
    return !has(pt.parent);
};

exports.getPtId = function(pt) {
    var cdi = pt.data.data;
    return cdi.id;
};

exports.isHierarchyRoot = function(pt) {
    var cdi = pt.data.data;
    return cdi.pid === '';
};

function getLabelStr(label) {
    return has(label) ? label : '~';
}

exports.getDirectoryLabel = function(d) {
    var labelStr = getLabelStr(d.data.label);
    return has(d.parent) ? exports.getDirectoryLabel(d.parent) + ' | ' + labelStr : labelStr;
};

exports.getMaxDepth = function(trace) {
    return trace.maxdepth >= 0 ? trace.maxdepth : Infinity;
};

exports.findEntryWithLevel = function(hierarchy, level) {
    var out;
    if(level) {
        hierarchy.eachAfter(function(pt) {
            if(exports.getPtId(pt) === level) {
                return out = pt.copy();
            }
        });
    }
    return out || hierarchy;
};

exports.findEntryWithChild = function(hierarchy, childId) {
    var out;
    hierarchy.eachAfter(function(pt) {
        var children = pt.children || [];
        for(var i = 0; i < children.length; i++) {
            var child = children[i];
            if(exports.getPtId(child) === childId) {
                return out = pt.copy();
            }
        }
    });
    return out || hierarchy;
};

exports.setSliceCursor = function(sliceTop, gd, opts) {
    var pt = sliceTop.datum();
    var isTransitioning = (opts || {}).isTransitioning;
    setCursor(sliceTop, (
        isTransitioning ||
        exports.isLeaf(pt) ||
        exports.isHierarchyRoot(pt)
    ) ? null : 'pointer');
};

exports.getInsideTextFontKey = function(keyStr, trace, pt, layoutFont) {
    var ptNumber = pt.data.data.i;

    return (
        Lib.castOption(trace, ptNumber, 'insidetextfont.' + keyStr) ||
        Lib.castOption(trace, ptNumber, 'textfont.' + keyStr) ||
        layoutFont.size
    );
};

exports.getOutsideTextFontKey = function(keyStr, trace, pt, layoutFont) {
    var ptNumber = pt.data.data.i;

    return (
        Lib.castOption(trace, ptNumber, 'outsidetextfont.' + keyStr) ||
        Lib.castOption(trace, ptNumber, 'textfont.' + keyStr) ||
        layoutFont.size
    );
};

function determineOutsideTextFont(trace, pt, layoutFont) {
    return {
        color: exports.getOutsideTextFontKey('color', trace, pt, layoutFont),
        family: exports.getOutsideTextFontKey('family', trace, pt, layoutFont),
        size: exports.getOutsideTextFontKey('size', trace, pt, layoutFont)
    };
}

function determineInsideTextFont(trace, pt, layoutFont) {
    var cdi = pt.data.data;
    var ptNumber = cdi.i;

    var customColor = Lib.castOption(trace, ptNumber, 'insidetextfont.color');
    if(!customColor && trace._input.textfont) {
        // Why not simply using trace.textfont? Because if not set, it
        // defaults to layout.font which has a default color. But if
        // textfont.color and insidetextfont.color don't supply a value,
        // a contrasting color shall be used.
        customColor = Lib.castOption(trace._input, ptNumber, 'textfont.color');
    }

    return {
        color: customColor || Color.contrast(cdi.color),
        family: exports.getInsideTextFontKey('family', trace, pt, layoutFont),
        size: exports.getInsideTextFontKey('size', trace, pt, layoutFont)
    };
}

exports.isOutsideText = function(trace, pt) {
    return !trace._hasColorscale && exports.isHierarchyRoot(pt);
};

exports.determineTextFont = function(trace, pt, layoutFont) {
    return exports.isOutsideText(trace, pt) ?
        determineOutsideTextFont(trace, pt, trace, pt, layoutFont) :
        determineInsideTextFont(trace, pt, trace, pt, layoutFont);
};
