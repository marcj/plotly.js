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

var extendFlat = require('../../lib/extend').extendFlat;

module.exports = {
    labels: {
        valType: 'data_array',
        editType: 'calc',
        description: [
            'Sets the labels of each of the treemap sectors.'
        ].join(' ')
    },
    parents: {
        valType: 'data_array',
        editType: 'calc',
        description: [
            'Sets the parent sectors for each of the treemap sectors.',
            'Empty string items \'\' are understood to reference',
            'the root node in the hierarchy.',
            'If `ids` is filled, `parents` items are understood to be "ids" themselves.',
            'When `ids` is not set, plotly attempts to find matching items in `labels`,',
            'but beware they must be unique.'
        ].join(' ')
    },

    values: {
        valType: 'data_array',
        editType: 'calc',
        description: [
            'Sets the values associated with each of the treemap sectors.',
            'Use with `branchvalues` to determine how the values are summed.'
        ].join(' ')
    },
    branchvalues: {
        valType: 'enumerated',
        values: ['remainder', 'total'],
        dflt: 'remainder',
        editType: 'calc',
        role: 'info',
        description: [
            'Determines how the items in `values` are summed.',
            'When set to *total*, items in `values` are taken to be value of all its descendants.',
            'When set to *remainder*, items in `values` corresponding to the root and the branches sectors',
            'are taken to be the extra part not part of the sum of the values at their leaves.'
        ].join(' ')
    },

    level: {
        valType: 'any',
        editType: 'plot',
        anim: true,
        role: 'info',
        description: [
            'Sets the level from which this treemap trace hierarchy is rendered.',
            'Set `level` to `\'\'` to start the treemap from the root node in the hierarchy.',
            'Must be an "id" if `ids` is filled in, otherwise plotly attempts to find a matching',
            'item in `labels`.'
        ].join(' ')
    },
    maxdepth: {
        valType: 'integer',
        editType: 'plot',
        role: 'info',
        dflt: -1,
        description: [
            'Sets the number of rendered treemap depth from any given `level`.',
            'Set `maxdepth` to *-1* to render all the levels in the hierarchy.'
        ].join(' ')
    },

    tiling: {
        packing: {
            dflt: 'squarify',
            values: [
                'binary',
                'squarify',
                'slice-dice',
                'slice',
                'dice'
            ],
            valType: 'enumerated',
            role: 'info',
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
        side: {
            valType: 'enumerated',
            values: ['top', 'bottom', false],
            dflt: false,
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

        color: {
            dflt: '#ddd',
            valType: 'color',
            role: 'style',
            editType: 'style',
            description: 'Sets the color of directory bar.'
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
            'Determines which trace information appear on the graph.'
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
