/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var plotAttrs = require('../../plots/attributes');
var hovertemplateAttrs = require('../../components/fx/hovertemplate_attributes');
// var texttemplateAttrs = require('../../plots/texttemplate_attributes');
var colorScaleAttrs = require('../../components/colorscale/attributes');
var domainAttrs = require('../../plots/domain').attributes;
var pieAttrs = require('../pie/attributes');
var sunburstAttrs = require('../sunburst/attributes');

var extendFlat = require('../../lib/extend').extendFlat;

module.exports = {
    labels: sunburstAttrs.labels,
    parents: sunburstAttrs.parents,

    values: sunburstAttrs.values,
    branchvalues: sunburstAttrs.branchvalues,
    countbranches: sunburstAttrs.countbranches,

    level: sunburstAttrs.level,
    maxdepth: sunburstAttrs.maxdepth,

    sort: pieAttrs.sort,

    tiling: {
        packing: {
            valType: 'enumerated',
            values: [
                'squarify',
                'binary',
                'dice',
                'slice',
                'slice-dice',
                'dice-slice'
            ],
            dflt: 'squarify',
            role: 'info',
            editType: 'plot',
            description: [
                'Determines d3 treemap solver.',
                'For more info please refer to https://github.com/d3/d3-hierarchy#treemap-tiling'
            ].join(' ')
        },

        mirror: {
            xy: {
                valType: 'boolean',
                dflt: false,
                role: 'style',
                editType: 'plot',
                description: [
                    'Determines if the x and y positions obtained from solver are swapped.'
                ].join(' ')
            },

            x: {
                valType: 'boolean',
                dflt: false,
                role: 'style',
                editType: 'plot',
                description: [
                    'Determines if the x positions obtained from solver are mirrored on the axis.'
                ].join(' ')
            },

            y: {
                valType: 'boolean',
                dflt: false,
                role: 'style',
                editType: 'plot',
                description: [
                    'Determines if the y positions obtained from solver are mirrored on the axis.'
                ].join(' ')
            },

            editType: 'plot'
        },

        aspectratio: {
            valType: 'number',
            role: 'info',
            min: 0,
            dflt: 1,
            editType: 'plot',
            description: [
                'Sets the preferred ratio between height and width of individual tiles.'
            ].join(' ')
        },

        pad: {
            valType: 'number',
            role: 'style',
            min: 0,
            dflt: 1,
            editType: 'plot',
            description: [
                'Sets the inner padding i.e in pixels when using `aspectratio` 1.'
            ].join(' ')
        },

        editType: 'plot',
    },

    marker: extendFlat({
        pad: {
            top: {
                valType: 'number',
                role: 'style',
                min: 0,
                dflt: 'auto',
                editType: 'plot',
                description: [
                    'Sets the padding form the top (in px).'
                ].join(' ')
            },
            left: {
                valType: 'number',
                role: 'style',
                min: 0,
                dflt: 'auto',
                editType: 'plot',
                description: [
                    'Sets the padding form the left (in px).'
                ].join(' ')
            },
            right: {
                valType: 'number',
                role: 'style',
                min: 0,
                dflt: 'auto',
                editType: 'plot',
                description: [
                    'Sets the padding form the right (in px).'
                ].join(' ')
            },
            bottom: {
                valType: 'number',
                role: 'style',
                min: 0,
                dflt: 'auto',
                editType: 'plot',
                description: [
                    'Sets the padding form the bottom (in px).'
                ].join(' ')
            },
            editType: 'plot'
        },

        colors: {
            valType: 'data_array',
            editType: 'calc',
            description: [
                'Sets the color of each sector of this treemap chart.',
                'If not specified, the default trace color set is used',
                'to pick the sector colors.'
            ].join(' ')
        },

        opacity: {
            valType: 'number',
            editType: 'style',
            role: 'style',
            min: 0,
            max: 1,
            description: [
                'Sets the opacity for the sectors. With colorscale',
                'it is defaulted to 1; otherwise it is defaulted to 0.5'
            ].join(' ')
        },

        line: {
            color: extendFlat({}, pieAttrs.marker.line.color, {
                dflt: null,
                description: [
                    'Sets the color of the line enclosing each sector.',
                    'Defaults to the `paper_bgcolor` value.'
                ].join(' ')
            }),
            width: extendFlat({}, pieAttrs.marker.line.width, {dflt: 1}),
            editType: 'plot'
        },

        editType: 'plot'
    },
        colorScaleAttrs('marker', {
            colorAttr: 'colors',
            anim: false // TODO: set to anim: true?
        })
    ),

    hovered: {
        marker: {
            line: {
                color: extendFlat({}, pieAttrs.marker.line.color, {
                    dflt: 'auto',
                    description: [
                        'Sets the color of the line enclosing each sector when hovered'
                    ].join(' ')
                }),
                width: extendFlat({}, pieAttrs.marker.line.width, {
                    dflt: 'auto',
                    description: [
                        'Sets the width (in px) of the line enclosing each sector when hovered.'
                    ].join(' ')
                }),
                editType: 'style'
            },

            opacity: {
                valType: 'number',
                editType: 'style',
                role: 'style',
                min: 0,
                max: 1,
                dflt: 'auto',
                description: [
                    'Sets the opacity for the sectors when hovered. With colorscale',
                    'it is defaulted to 1; otherwise it is defaulted to the average of',
                    'marker opacity and full opacity.'
                ].join(' ')
            },

            editType: 'style'
        },
        editType: 'style'
    },

    directory: {
        visible: {
            valType: 'boolean',
            dflt: true,
            role: 'info',
            editType: 'plot',
            description: [
                'Determines if directory bar is drawn.'
            ].join(' ')
        },

        position: {
            valType: 'enumerated',
            values: [
                'top left',
                'top right',
                'inside',
                'bottom left',
                'bottom right'
            ],
            dflt: 'bottom left',
            role: 'info',
            editType: 'plot',
            description: [
                'Determines on which side of the the treemap the',
                'directory bar should be presented.'
            ].join(' ')
        },

        height: {
            valType: 'number',
            min: 12,
            role: 'info',
            editType: 'plot',
            description: 'Sets the height of directory bar (in px).'
        },

        textfont: extendFlat({}, pieAttrs.textfont, {
            description: 'Sets the font used inside directory bar.'
        }),

        editType: 'plot'
    },

    text: pieAttrs.text,
    textinfo: {
        valType: 'flaglist',
        role: 'info',
        flags: [
            'label',
            'text',
            'value',
            'percent parent',
            'percent total'
        ],
        extras: ['none'],
        editType: 'plot',
        description: [
            'Determines which trace information appear on the graph.',
            'Total percents are computed from the current directory',
            'not the hierarchy root.'
        ].join(' ')
    },

    /*
    texttemplate: texttemplateAttrs({editType: 'plot'}, {
        keys: [
            'label',
            'text',
            'value',
            'color',
            'percentParent',
            'percentTotal'
        ]
    }),
    */

    hovertext: pieAttrs.hovertext,
    hoverinfo: extendFlat({}, plotAttrs.hoverinfo, {
        flags: [
            'label',
            'text',
            'value',
            'name',
            'percent parent',
            'percent total'
        ]
    }),
    hovertemplate: hovertemplateAttrs({
        keys: [
            'label',
            'text',
            'value',
            'text',
            'percentParent',
            'percentTotal'
        ]
    }),

    textfont: pieAttrs.textfont,
    insidetextfont: pieAttrs.insidetextfont,
    outsidetextfont: pieAttrs.outsidetextfont,

    textposition: {
        valType: 'enumerated',
        values: [
            'top left', 'top center', 'top right',
            'middle left', 'middle center', 'middle right',
            'bottom left', 'bottom center', 'bottom right'
        ],
        dflt: 'top left',
        role: 'style',
        editType: 'plot',
        description: [
            'Sets the positions of the `text` elements.'
        ].join(' ')
    },

    domain: domainAttrs({name: 'treemap', trace: true, editType: 'plot'})
};
