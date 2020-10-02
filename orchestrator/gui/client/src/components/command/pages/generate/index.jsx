import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Promise from 'promise-polyfill';
import Ajv from 'ajv';
import { toast } from 'react-toastify';
import JSONPretty from 'react-json-pretty';
import {
  Button, ButtonGroup, Form, FormGroup, FormText, Input, Nav, NavItem, NavLink, TabContent, TabPane
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';

import JSON_FIELD from './lib';
import {
  delMultiKey, generateUUID4, objectValues, safeGet, setMultiKey, validateUUID4
} from '../../../utils';
import * as GenerateActions from '../../../../actions/generate';
import * as CommandActions from '../../../../actions/command';

const editorTheme = { // Theming for JSONPretty
  main: 'color:#D4D4D4;background:#FCFDFD;overflow:auto;',
  error: 'color:#f92672;background:#FEECEB;overflow:auto;',
  key: 'color:#59A5D8;',
  string: 'color:#FA7921;',
  value: 'color:#386FA4;',
  boolean: 'color:#386FA4;'
};

class GenerateCommands extends Component {
  constructor(props, context) {
    super(props, context);
    this.optChange = this.optChange.bind(this);
    this.selectChange = this.selectChange.bind(this);
    this.clearCommand = this.clearCommand.bind(this);
    this.sendCommand = this.sendCommand.bind(this);
    this.updateChannel = this.updateChannel.bind(this);

    this.json_validator = new Ajv({
      unknownFormats: 'ignore'
    });

    this.state = {
      active_tab: 'creator',
      msg_record: '',
      channel: {
        serialization: '',
        protocol: ''
      },
      schema: {
        schema: {},
        selected: 'empty',
        type: '',
        exports: []
      },
      message: {},
      message_warnings: []
    };

    const { actuatorInfo, deviceInfo } = this.props;
    actuatorInfo();
    deviceInfo();
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { setSchema } = this.props;
    const { schema } = this.state;

    const propsUpdate = this.props !== nextProps;
    const stateUpdate = this.state !== nextState;

    if (schema.schema !== nextState.schema.schema) {
      setSchema(nextState.schema.schema);
      // eslint-disable-next-line no-param-reassign
      nextState.message = {};
      // eslint-disable-next-line no-param-reassign
      nextState.channel = {
        serialization: '',
        protocol: ''
      };
    } else if (schema.schema !== nextProps.selected.schema) {
      // eslint-disable-next-line no-param-reassign
      nextState.schema = {
        ... nextState.schema,
        schema: nextProps.selected.schema,
        profile: nextProps.selected.profile
      };
      setSchema(nextState.schema.schema);
      // eslint-disable-next-line no-param-reassign
      nextState.message = {};
      // eslint-disable-next-line no-param-reassign
      nextState.channel = {
        serialization: '',
        protocol: ''
      };
    }

    if ('properties' in nextState.schema.schema) {
      // eslint-disable-next-line no-param-reassign
      nextState.schema.exports = Object.keys(nextState.schema.schema.properties).map(k => {
        const def = safeGet(nextState.schema.schema.properties, k, {});
        return '$ref' in def ? def.$ref.replace(/^#\/definitions\//, '') : '';
      });
    } else {
      // eslint-disable-next-line no-param-reassign
      nextState.schema.exports = safeGet(nextState.schema.schema, 'oneOf', [])
        .map(exp => '$ref' in exp ? exp.$ref.replace(/^#\/definitions\//, '') : '');
    }
    // eslint-disable-next-line no-param-reassign
    nextState.schema.exports = nextState.schema.exports.filter(s => s);
    return propsUpdate || stateUpdate;
  }

  makeID() {
    this.setState(prevState => ({
      message: {
        ...prevState.message,
        command_id: generateUUID4()
      }
    }));
  }

  toggleTab(tab) {
    this.setState({
      active_tab: tab
    });
  }

  updateChannel(e) {
    const target = e.currentTarget;
    this.setState(prevState => ({
      channel: {
        ...prevState.channel,
        [target.id]: target.value
      }
    }));
  }

  sendCommand() {
    const { errors, sendCommand } = this.props;
    const { channel, message, schema } = this.state;

    if ('command_id' in message) {
      if (!validateUUID4(message.command_id)) {
        toast(
          <div>
            <p>Error:</p>
            <p>Command ID is not a valid UUIDv4</p>
          </div>,
          { type: toast.TYPE.WARNING }
        );
        return;
      }
    }

    if (schema.type === 'actuator') {
      if (channel.protocol === '') {
        toast(
          <div>
            <p>Error:</p>
            <p>Actuator protocol not set</p>
          </div>,
          { type: toast.TYPE.WARNING }
        );
        return;
      }
      if (channel.serialization === '') {
        toast(
          <div>
            <p>Error:</p>
            <p>Actuator serialization not set</p>
          </div>,
          { type: toast.TYPE.WARNING }
        );
        return;
      }
    }

    const actuator = `${schema.type}/${schema.selected}`;
    toast(
      <div>
        <p>Request sent</p>
      </div>,
      { type: toast.TYPE.INFO }
    );
    // sendCommand(message, actuator, channel);

    // eslint-disable-next-line promise/always-return, promise/catch-or-return
    Promise.resolve(sendCommand(message, actuator, channel)).then(() => {
      const errs = safeGet(errors, CommandActions.SEND_COMMAND_FAILURE, {});

      if (Object.keys(errs).length !== 0) {
        if ('non_field_errors' in errs) {
          objectValues(errs).forEach((err) => {
            toast(<p>{ `Error: ${err}` }</p>, {type: toast.TYPE.WARNING});
          });
        } else {
          Object.keys(errs).forEach((err) => {
            toast(
              <div>
                <p>{ `Error ${err}:` }</p>
                <p>{ errs[err] }</p>
              </div>,
              { type: toast.TYPE.WARNING }
            );
          });
        }
      } else {
        // TODO: Process responses ??
      }
      return 0;
    });
  }

  clearCommand() {
    this.setState({
      msg_record: '',
      message: {}
    });
  }

  optChange(k, v) {
    this.setState(prevState => {
      const msg = prevState.message || {};
      let keys = k.split('.');
      let errors = [];
      keys = prevState.schema.exports.includes(keys[0]) ? keys.slice(1): keys;

      if (keys.length > 1 && msg[keys[0]] && !msg[keys[0]][keys[1]]) {
        delMultiKey(msg, keys[0]);
      }
      if (['', ' ', null, undefined, [], {}].includes(v)) {
        delMultiKey(msg, k);
      } else {
        setMultiKey(msg, k, v);
      }
      // TODO: Validate message - errors to state.message_warnings as array
      // console.log('Generated from JSON', prevState.msg_record, msg)
      let tmpMsg = msg;
      if ('properties' in prevState.schema.schema) {
        const idx = prevState.schema.exports.indexOf(prevState.msg_record);
        const msgWrapper = Object.keys(prevState.schema.schema.properties)[idx];
        tmpMsg = {
          [msgWrapper]: msg
        };
      }
      try {
        const valid = this.json_validator.validate(prevState.schema.schema, tmpMsg);
        if (!valid) {
          errors = this.json_validator.errors;
        }
      } catch (err) {
        console.error(err);
        errors = [ JSON.stringify(err) ];
      }

      return {
        message: msg,
        message_warnings: errors
      };
    });
  }

  selectChange(e) {
    const { actuators } = this.props;

    const selected = e.target.value;
    const idx = e.nativeEvent.target.selectedIndex;
    const field = e.nativeEvent.target[idx].getAttribute('field');
    let schemaAct = '';

    if (field === 'profile') {
      let actProfile = actuators.filter((act) => act.profile === selected);

      if (actProfile.length === 0) {
        toast(<p>Something happened, invalid profile</p>, {type: toast.TYPE.WARNING});
        return;
      }
      actProfile = actProfile[Math.floor(Math.random()*actProfile.length)];
      schemaAct = actProfile.actuator_id;

    } else if (field === 'actuator') {
      let actName = actuators.filter((act) => act.actuator_id === selected);

      if (actName.length === 0 || actName.length > 1) {
        toast(<p>Something happened, invalid actuator</p>, {type: toast.TYPE.WARNING});
        return;
      }
      // eslint-disable-next-line prefer-destructuring
      actName = actName[0];
      schemaAct = actName.actuator_id;
    }

    this.setState(prevState => ({
      msg_record: '',
      message: {},
      schema: {
        ...prevState.schema,
        selected,
        type: field
      }
    }), () => {
      const { actuatorSelect } = this.props;
      actuatorSelect(schemaAct, field);
    });
  }

  schema(maxHeight) {
    const { actuators, devices } = this.props;
    const { schema } = this.state;

    const actuatorSchemas = [];
    let profileSchemas = [];

    actuators.forEach(act => {
      let dev = devices.filter(d => d.device_id === act.device);
      dev = dev.length === 1 ? dev[0] : {};
      actuatorSchemas.push(<option key={ act.actuator_id } value={ act.actuator_id } field='actuator' >{ `${dev ? `${dev.name} - ` : ''}${act.name}` }</option>);
      if (!profileSchemas.includes(act.profile)) {
        profileSchemas.push(act.profile);
      }
    });

    profileSchemas = profileSchemas.map(p => <option key={ p } value={ p } field='profile' >{ p }</option>);

    return (
      <div className="col-md-6">
        <div id="schema-card" className="tab-pane fade active show">
          <div className="card">
            <div className="card-header">
              <div className="row float-left col-sm-10 pl-0">
                <div className="form-group col-md-6 pr-0 pl-1">
                  <select id="schema-list" name="schema-list" className="form-control" default="empty" onChange={ this.selectChange }>
                    <option value="empty">Schema</option>
                    <optgroup label="Profiles">
                      { profileSchemas }
                    </optgroup>
                    <optgroup label="Actuators">
                      { actuatorSchemas }
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-control border card-body p-0" style={{ height: `${maxHeight}px` }}>
              <div className='p-1 position-relative' style={{ height: `${maxHeight-25}px`, overflowY: 'scroll' }}>
                <JSONPretty
                  id='schema'
                  className='scroll-xl'
                  style={{ minHeight: '2.5em' }}
                  data={ schema.schema }
                  theme={ editorTheme }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  cmdCreator(maxHeight) {
  const { actuators, devices, selected } = this.props;
  const {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    active_tab, channel, message, message_warnings, msg_record, schema
  } = this.state;

    const exportRecords = schema.exports.map(rec => <option key={ rec } value={ rec }>{ rec }</option>);
    let RecordDef = '';
    let actProtos = [];
    let actSerials = [];
    let warnings = <p>Warnings for the generated message will appear here if available</p>;

    if (selected.schema) {
      let recordDef = {};
      if (selected.schema.definitions && msg_record in selected.schema.definitions) {
        recordDef = selected.schema.definitions[msg_record];
        RecordDef = <JSON_FIELD name={ msg_record } def={ recordDef } root optChange={ this.optChange } />;
      }
    }

    if (schema.type === 'actuator') {
      let act = actuators.filter(a => a.actuator_id === schema.selected);
      act = act.length === 1 ? act[0] : {};
      let dev = devices.filter(d => d.device_id === act.device);
      dev = dev.length === 1 ? dev[0] : {};

      actProtos = dev.transport.map(trans => {
        if (trans.protocol === channel.protocol) {
          actSerials = trans.serialization.map(serial => <option key={ serial } value={ serial }>{ serial }</option>);

          if (trans.serialization.indexOf(channel.serialization) === -1 && channel.serialization !== '') {
            this.setState(prevState => ({
              channel: {
                ...prevState.channel,
                serialization: ''
              }
            }));
          }
        }
        return (<option key={ trans.transport_id } value={ trans.protocol }>{ trans.protocol }</option>);
      });
      setTimeout(() => {
        const defTrans = dev.transport.length >= 1 ? dev.transport[0] : {};
        if (channel.protocol === '') {
          this.setState(prevState => ({
            channel: {
              ...prevState.channel,
              protocol: defTrans.protocol,
              serialization: defTrans.serialization[0]
            }
          }));
        }
      }, 10);
    }

    if (message_warnings.length !== 0) {
      warnings = message_warnings.map((err, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={ i } className="border border-warning mb-2 px-2 pt-2">
          <p>
            { `Warning from message ${err.dataPath || '.'}` }
            <FontAwesomeIcon icon={ faLongArrowAltRight } className="mx-2" />
            { `"${ err.keyword }"` }
          </p>
          <p className="text-warning">{ err.message }</p>
        </div>
      ));
     }

    return (
      <div className='col-md-6'>
        <Nav tabs>
          <NavItem>
            <NavLink className={ active_tab === 'creator' ? 'active' : '' } onClick={ () => this.toggleTab('creator') }>Creator</NavLink>
          </NavItem>
          <NavItem>
            <NavLink className={ active_tab === 'message' ? 'active' : '' } onClick={ () => this.toggleTab('message') }>Message</NavLink>
          </NavItem>
          <NavItem>
            <NavLink className={ active_tab === 'warning' ? 'active' : '' } onClick={ () => this.toggleTab('warning') }>
              Warnings&nbsp;
              <span className={ `badge badge-${message_warnings.length > 0 ? 'warning' : 'success'}` }>{ message_warnings.length }</span>
            </NavLink>
          </NavItem>
        </Nav>

        <TabContent activeTab={ active_tab }>
          <TabPane tabId='creator'>
            <div className='card col-12 p-0 mx-auto'>
              <div className='card-header'>
                <FormGroup className='col-md-6 p-0 m-0 float-left'>
                  <Input type='select' className='form-control' value={ msg_record } onChange={ e => { this.setState({'msg_record': e.target.value, message: {}}); } }>
                    <option value=''>Message Type</option>
                    <optgroup label="Exports">
                      { exportRecords }
                    </optgroup>
                  </Input>
                </FormGroup>
                <Button color='primary' className='float-right' onClick={ () => this.makeID() }>Generate ID</Button>
              </div>

              <Form id='command-fields' className='card-body' onSubmit={ () => false } style={{ height: `${maxHeight-30}px`, overflowY: 'scroll' }}>
                <div id="fieldDefs">
                  { msg_record === '' ? <FormText color="muted">Message Fields will appear here after selecting a type</FormText> : RecordDef }
                </div>
              </Form>
            </div>
          </TabPane>

          <TabPane tabId='message'>
            <div className='card col-12 p-0 mx-auto'>
              <div className='card-header'>
                <ButtonGroup className='float-right col-2' vertical>
                  <Button color='danger' onClick={ this.clearCommand } style={{ padding: '.1rem 0' }}>Clear</Button>
                  <Button color='primary' onClick={ this.sendCommand } style={{ padding: '.1rem 0' }}>Send</Button>
                </ButtonGroup>
                <div className={ `col-10 p-0 ${schema.type === 'actuator' ? '' : ' d-none'}` }>
                  <FormGroup className='col-md-6 p-0 m-0 float-left'>
                    <Input id="protocol" type='select' className='form-control' value={ channel.protocol } onChange={ this.updateChannel }>
                      <option value=''>Protocol</option>
                      { actProtos }
                    </Input>
                  </FormGroup>
                  <FormGroup className='col-md-6 p-0 m-0 float-left'>
                    <Input id='serialization' type='select' className='form-control' value={ channel.serialization } onChange={ this.updateChannel }>
                      <option value=''>Serialization</option>
                      { actSerials }
                    </Input>
                  </FormGroup>
                </div>
              </div>

              <div className='card-body p-1 position-relative' style={{ height: `${maxHeight-25}px`, overflowY: 'scroll' }}>
                <JSONPretty
                  id='message'
                  className='scroll-xl'
                  style={{ minHeight: '2.5em' }}
                  data={ message }
                  theme={ editorTheme }
                />
              </div>
            </div>
          </TabPane>

          <TabPane tabId='warning'>
            <div className='card col-12 p-0 mx-auto'>
              <div className='card-header h3'>
                Message Warnings
              </div>
              <div className='card-body p-2 position-relative' style={{ height: `${maxHeight-25}px`, overflowY: 'scroll' }}>
                { warnings }
              </div>
            </div>
          </TabPane>
        </TabContent>
      </div>
    );
  }

  render() {
    const maxHeight = window.innerHeight - (parseInt(document.body.style.paddingTop, 10) || 0) - 260;

    return (
      <div className='row mt-3'>
        { this.schema(maxHeight) }
        <div className='col-12 m-2 d-md-none' />
        { this.cmdCreator(maxHeight) }
        <div id='cmd-status' className='modal'>
          <div className='modal-dialog h-100 d-flex flex-column justify-content-center my-0' role='document'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>
                  Command:&nbsp;
                  <span />
                </h5>
              </div>

              <div className='modal-body'>
                <p className='cmd-details'>
                  <b>Details:</b>
                  <span />
                </p>
                <p className='mb-1'>
                  <b>Command:</b>
                </p>
                <pre className='border code command' />
                <p className='mb-1'>
                  <b>Responses:</b>
                </p>
                <div className='p-1 border border-primary responses' />

                <button type='button' className='close' data-dismiss='modal' aria-label='Close'>
                  <span aria-hidden='true'>&times;</span>
                </button>
              </div>

              <div className='modal-footer'>
                <button type='button' className='btn btn-secondary' data-dismiss='modal'>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

GenerateCommands.propTypes = {
  actuators: PropTypes.array.isRequired,
  actuatorInfo: PropTypes.func.isRequired,
  actuatorSelect: PropTypes.func.isRequired,
  devices: PropTypes.array.isRequired,
  deviceInfo: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
  selected: PropTypes.shape({
    profile: PropTypes.string,
    schema: PropTypes.object
  }).isRequired,
  sendCommand: PropTypes.func.isRequired,
  setSchema: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  actuators: state.Generate.actuators || [],
  devices: state.Generate.devices || [],
  selected: state.Generate.selected || {},
  errors: state.Command.errors
});

const mapDispatchToProps = dispatch => ({
  setSchema: schema => dispatch(GenerateActions.setSchema(schema)),
  actuatorInfo: () => dispatch(GenerateActions.actuatorInfo()),
  actuatorSelect: (act, t) => dispatch(GenerateActions.actuatorSelect(act, t)),
  deviceInfo: () => dispatch(GenerateActions.deviceInfo()),
  sendCommand: (cmd, act, chan) => dispatch(CommandActions.sendCommand(cmd, act, chan))
});

export default connect(mapStateToProps, mapDispatchToProps)(GenerateCommands);