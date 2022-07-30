/* eslint-disable no-useless-catch */
/* eslint-disable no-unused-vars */
/*
	DataBridges JavaScript client Library for browsers
	https://www.databridges.io/



	Copyright 2022 Optomate Technologies Private Limited.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/


import { MessageTypes } from "../msgTypes/dBMessageTypes.js";
import { Crpcclient } from "./rpcclient.js";
import { rpcStatus } from "./rpcstatus.js";
import { dispatcher } from "../dispatcher/dispatcher.js";
//import * as utils from "../Utils/util.js";
import { CrpCaller } from "./rpcCaller.js";
import { CaccessRpcResponse } from "./rpcaccessResponse.js";
import { dBError } from "../exception/errorMessages.js";
import * as utils from "../Utils/util.js";
//import { util } from "webpack";

export class CRpc { 

  constructor(dbcorelib) {
    this._dbcore = dbcorelib;
    this.cf = new Crpcclient(this._dbcore);
    this._serverName_sid = new Map();
    this._serverSid_registry = new Map();
    this._dispatch = new dispatcher();
    this._callersid_object = new Map(); 
    this._server_type = ["pvt", "prs", "sys"]; 
  }

  isEmptyOrSpaces(str) {
    return str === null || (/^ *$/).test(str);
  }
  
  _validateServerName(serverName, mtype = 0) {
    if (this.isEmptyOrSpaces(serverName)) {
      if (mtype == 1) {
        throw (new dBError("E048"));
      }
    }
    
    if (serverName.length > 64) {
      if (mtype == 1) {
        throw (new dBError("E051"));
      }
    } 
    
    if (!(/^[a-zA-Z0-9.:_-]*$/.test(serverName))) {
      if (mtype == 1) {
        throw (new dBError("E052"));
      }
    }
    
    if (serverName.includes(":")) {
      var sdata = serverName.toLowerCase().split(":");
      if (!this._server_type.includes(sdata[0])) {
        if (mtype == 1) {
          throw (new dBError("E052"));
        }
      }
    }
  }
  
  _get_rpcStatus(sid) { 
    return this._serverSid_registry.get(sid).status;
  }
  
  bind(eventName, callback) {
  
    this._dispatch.bind(eventName, callback);
  }
  
  unbind(eventName, callback) {
    this._dispatch.unbind(eventName, callback);
  }
  
  bind_all(callback) {
    this._dispatch.bind_all(callback);
  }
  
  unbind_all(callback) {
    this._dispatch.unbind_all(callback);
  }
  
  _ReSubscribeAll() {
    const _communicateR = async (serverName, sid, access_token) => {
      let cStatus = false;
      cStatus = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.CONNECT_TO_RPC_SERVER, serverName, sid, access_token);
      if (!cStatus) {
        throw (new dBError("E053")); 
      }
    };
    
    const _ReSubscribe = async (sid) => {
      let m_object = this._serverSid_registry.get(sid);
      let access_token = undefined; 
      const mprivate = this.isPrivateChannel(m_object.name);

      switch (m_object.status) { 
      case rpcStatus.RPC_CONNECTION_ACCEPTED:
        try {
          if (!mprivate) {
            _communicateR(m_object.name, sid, access_token);
          } else {
            const response = new CaccessRpcResponse(m_object.name, sid, this);
            this._dbcore._accesstoken_dispatcher(m_object.name, utils.accessTokenActions.RPCCONNECT, response);
          }
        } catch (error) {
          this._handleRegisterEvents([utils.systemEvents.RPC_CONNECT_FAIL], error, m_object);
          return;
        }
        break;
      }
    };
    this._serverName_sid.forEach((sidmap, key) => {
      sidmap.forEach((value, sid) => {
        _ReSubscribe(sid);
      });
    });
  } 

  _handledispatcherEvent(eventName, serverName) {
    this._dispatch.emit(eventName, serverName);
    let sidmap = this._serverName_sid.get(serverName);
    sidmap.forEach((value, sid) => {
      let m_object = this._serverSid_registry.get(sid);
      if (!m_object) return;
      m_object.ino.emit(eventName, serverName);
    });
  } 

  _handleRegisterEvents(eventName, eventData, m_object) {
    const dispatchEvents = async (i) => {
      let metadata = { "servername": m_object.ino.getServerName(), "eventname": eventName[i] };

      this._dispatch.emit_channel(eventName[i], eventData, metadata);
      m_object.ino.emit(eventName[i], eventData, metadata);
      i = i + 1;
      if (i < eventName.length) {
        dispatchEvents(i);
      }
    };
    if (eventName.length > 0) {
      dispatchEvents(0);
    }
  }

  _handleRegisterEventsOld(eventName, eventData, m_object) {
    const dispatchEvents = async (i) => {
      m_object.ino.emit(eventName[i], eventData, m_object.ino.getServerName());
      this._handledispatcherEvent(eventName[i], eventData, m_object.ino.getServerName());
      i = i + 1;
      if (i < eventName.length) {
        dispatchEvents(i);
      }
    };
    if (eventName.length > 0) {
      dispatchEvents(0);
    }
  }
  _updateRegistrationStatus(sid, status, reason) {
    if (!this._serverSid_registry.has(sid)) return;
    let m_object = this._serverSid_registry.get(sid);

    switch (m_object.type) {
    case "r":
      switch (status) {
      case rpcStatus.REGISTRATION_ACCEPTED:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(true);
        this._handleRegisterEvents([utils.systemEvents.REGISTRATION_SUCCESS, utils.systemEvents.SERVER_ONLINE], "", m_object);
        break;
      default:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(false);
        this._handleRegisterEvents([utils.systemEvents.REGISTRATION_FAIL], reason, m_object);
        this._serverName_sid.get(m_object.name).delete(sid);
        this._serverSid_registry.delete(sid);

        break;

      }
      break;
    case "c":
      switch (status) {
      case rpcStatus.RPC_CONNECTION_ACCEPTED:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(true);
        this._handleRegisterEvents([utils.systemEvents.RPC_CONNECT_SUCCESS, utils.systemEvents.SERVER_ONLINE], "", m_object);
        break;
      default:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(false);
        this._handleRegisterEvents([utils.systemEvents.RPC_CONNECT_FAIL], reason, m_object);
        this._serverName_sid.get(m_object.name).delete(sid);
        this._serverSid_registry.delete(sid);

        break;

      }
      break;
    default:
      break;
    }

  } 


  _updateRegistrationStatusRepeat(sid, status, reason) {
    if (!this._serverSid_registry.has(sid)) return;
    let m_object = this._serverSid_registry.get(sid);

    switch (m_object.type) {
    case "r":
      switch (status) {
      case rpcStatus.REGISTRATION_ACCEPTED:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(true);
        this._handleRegisterEvents([utils.systemEvents.SERVER_ONLINE], "", m_object);
        break;
      default:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(false);
        this._handleRegisterEvents([utils.systemEvents.SERVER_OFFLINE], reason, m_object);
        break;

      }
      break;
    case "c":
      switch (status) {
      case rpcStatus.RPC_CONNECTION_ACCEPTED:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(true);
        this._handleRegisterEvents([utils.systemEvents.SERVER_ONLINE], "", m_object);
        break;
      default:
        this._serverSid_registry.get(sid).status = status;
        m_object.ino._set_isOnline(false);
        this._handleRegisterEvents([utils.systemEvents.SERVER_OFFLINE], reason, m_object);
        break;

      }
      break;
    default:
      break;
    } 
  } 

  _updateRegistrationStatusAddChange(life_cycle, sid, status, reason) {
    if (life_cycle == 0)  // first time subscription 
    { 
      this._updateRegistrationStatus(sid, status, reason);
    } else { // resubscribe due to network failure 
      this._updateRegistrationStatusRepeat(sid, status, reason);
    }
  }


  isPrivateChannel(serverName) {
    let flag = false;
    if (serverName.includes(":")) {
      var sdata = serverName.toLowerCase().split(":");
      if (this._server_type.includes(sdata[0])) {
        flag = true;
      } else {
        flag = false;
      }
    }
    return flag;

  }


  _communicate(serverName, mprivate, action) {
    let cStatus = false; 
    let m_value = undefined;
    let access_token = null;
    let sid = utils.GenerateUniqueId();

    if (!mprivate) {
      cStatus = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.CONNECT_TO_RPC_SERVER, serverName, sid, access_token);
      if (!cStatus) throw (new dBError("E053"));

    } else { 
      const response = new CaccessRpcResponse(serverName, sid, this);
      this._dbcore._accesstoken_dispatcher(serverName, action, response);
    }

    let rpccaller = new CrpCaller(serverName, this._dbcore, this);

    m_value = { "name": serverName, "type": "c", "status": rpcStatus.RPC_CONNECTION_INITIATED, "ino": rpccaller };
    if (this._serverName_sid.has(serverName)) {
      this._serverName_sid.get(serverName).set(sid, null);
    } else {
      this._serverName_sid.set(serverName, new Map());
      this._serverName_sid.get(serverName).set(sid, null);
    }
    this._serverSid_registry.set(sid, m_value);


    return rpccaller;
  }



  _verify_acccess_response(access_object) { 
    let merror = ""; 
    if (!("statuscode" in access_object)) {
      merror = "the return object structure is blank, does not contain statuscode key";
      return { "result": false, "msg": merror, "token": "" };
    } 
    if ((typeof access_object.statuscode != "number")) {
      merror = "the return object structure is blank, statuscode vaule must be numeric";
      return { "result": false, "msg": merror, "token": "" };
    } 
    if (access_object.statuscode != 0) {
      if (!("error_message" in access_object)) {
        merror = "access_token function return statuscode: " + access_object.statuscode + " error_message tag missing";
      } else {
        merror = access_object.error_message;
      }
      return { "result": false, "msg": merror, "token": "" };
    }

    if (!("accesskey" in access_object)) {
      merror = "access_token function return statuscode: " + access_object.statuscode + " accesskey tag missing";
      return { "result": false, "msg": merror, "token": "" };
    }
    if (!access_object.accesskey) {
      merror = "access_token function return statuscode: " + access_object.statuscode + " accesskey is blank";
      return { "result": false, "msg": merror, "token": "" };
    }


    return { "result": true, "msg": "", "token": access_object.accesskey };
  }

  _failure_dispatcher(sid, reason) {
    let dberror = undefined;
    const m_object = this._serverSid_registry.get(sid);
    m_object.ino._set_isOnline(false); 
    dberror = new dBError("E104");
    dberror.updatecode("", reason); 
    this._handleRegisterEvents([utils.systemEvents.RPC_CONNECT_FAIL], dberror, m_object);

    this._serverName_sid.get(m_object.name).delete(sid);
    this._serverSid_registry.delete(sid);
  }
  _send_to_dbr(serverName, sid, access_data) {
    let cStatus = undefined;

    let v_result = this._verify_acccess_response(access_data);
    if (!v_result.result) {
      this._failure_dispatcher(sid, v_result.msg);
      return;
    }
    let access_token = v_result.token; 
    cStatus = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.CONNECT_TO_RPC_SERVER, serverName, sid, access_token); 
    if (!cStatus) {
      this._failure_dispatcher(sid, "library is not connected with the dbridges network");
    }

  }

  connect(serverName) {
    try {
      this._validateServerName(serverName, 1);
    } catch (error) {
      throw (error);
    } 
    const mprivate = this.isPrivateChannel(serverName); 
    let m_caller = undefined; 
    try {
      m_caller = this._communicate(serverName, mprivate, utils.accessTokenActions.RPCCONNECT);
    } catch (error) {
      throw (error);
    }
    return m_caller;
  }

  ChannelCall(channelName) {

    if (this._serverName_sid.has(channelName)) {
      let sid = [... this._serverName_sid.get(channelName).keys()][0];
      let mobject = this._serverSid_registry.get(sid);
      //this._serverSid_registry.get(sid).count = mobject.count + 1;
      return mobject.ino;
    }
    let sid = utils.GenerateUniqueId();
    let rpccaller = new CrpCaller(channelName, this._dbcore, this, "ch");
    this._serverName_sid.set(channelName, new Map());
    this._serverName_sid.get(channelName).set(sid, null);
    let m_value = { "name": channelName, "type": "x", "status": rpcStatus.RPC_CONNECTION_INITIATED, "ino": rpccaller, "count": 1 };
    this._serverSid_registry.set(sid, m_value);
    return rpccaller;

       
  }

  /*ClearChannel(channelName) {
    if (!this._serverName_sid.has(channelName)) return;
    let sid = this._serverName_sid.get(channelName); 
    if (this._serverSid_registry.get(sid).count == 1) {
      this._serverName_sid.delete(channelName);
      this._serverSid_registry.delete(sid);
    } else {
      let mobject = this._serverSid_registry.get(sid);
      this._serverSid_registry.get(sid).count = mobject.count - 1;
    }
  }*/

  store_object(sid, rpccaller) {
    this._callersid_object.set(sid, rpccaller);
  }

  delete_object(sid) {
    this._callersid_object.delete(sid);
  }

  get_object(sid) {
    if (this._callersid_object.has(sid)) return this._callersid_object.get(sid);

  }
  
  _send_OfflineEvents() {
    this._serverName_sid.forEach((sidmap, key) => {
      sidmap.forEach((svalue, sid) => {
        let value = this._serverSid_registry.get(sid);
        value.ino._set_isOnline(false);
        this._handleRegisterEvents([utils.systemEvents.SERVER_OFFLINE], "", value);
      });
    }); 
  }

  cleanUp_All() {
    const clean_channel = (sid) => {
      return new Promise(resolve => {
        let mobject = this._serverSid_registry.get(sid);
        mobject.ino.unbind();
        resolve();
      });
    };    
    this._serverName_sid.forEach((sidmap, key) => {
      sidmap.forEach((svalue, sid) => {
        clean_channel(sid).then(() => {
          this._serverSid_registry.delete(sid);
        });
      });
      this._serverName_sid.delete(key);
    });
  }

} 