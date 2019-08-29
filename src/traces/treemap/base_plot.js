/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var base = require('../../plots/area/base');

exports.name = 'treemap';

exports.plot = function(gd, traces, transitionOpts, makeOnCompleteCallback) {
    base._runPlot(exports.name, gd, traces, transitionOpts, makeOnCompleteCallback);
};

exports.clean = function(newFullData, newFullLayout, oldFullData, oldFullLayout) {
    base._runClean(exports.name, newFullData, newFullLayout, oldFullData, oldFullLayout);
};
