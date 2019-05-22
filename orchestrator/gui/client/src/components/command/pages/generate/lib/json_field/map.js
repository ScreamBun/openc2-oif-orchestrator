import React, { Component } from 'react'
import { connect } from 'react-redux'

import {
    Button,
    Form,
    FormGroup,
    FormText,
    Input,
    Label,
} from 'reactstrap'

import {
    isOptional_json,
    Field
} from './'

import * as GenActions from '../../../../../../actions/generate'


class MapField extends Component {
    render() {
        let name = this.props.name || this.props.def.name
        let msgName = (this.props.parent ? [this.props.parent, name] : [name]).join('.')

        let def_opts = []
        Object.keys(this.props.def.anyOf[0].properties).map((field, i) => {
            let fieldArgs = {
                key: i,
                name: field,
                def: this.props.def.anyOf[0].properties[field],
                required: isOptional_json(this.props.def.required, field),
                parent: this.props.parent ? msgName : "",
                optChange: this.props.optChange
            }
            def_opts.push(<Field { ...fieldArgs } />)
        })

        return (
            <FormGroup tag="fieldset" className="border border-dark p-2">
                <legend>{ (this.props.required ? '*' : '') + name }</legend>
                { this.props.def.description != '' ? <FormText color="muted">{ this.props.def.description }</FormText> : '' }
                <div className="col-12 my-1 px-0">
                    { def_opts }
                </div>
            </FormGroup>
        )
    }
}

const mapStateToProps = (state) => ({
    schema: state.Generate.selectedSchema
})

export default connect(mapStateToProps)(MapField)
