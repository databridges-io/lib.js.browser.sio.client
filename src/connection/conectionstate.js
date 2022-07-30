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


import { dispatcher } from "../dispatcher/dispatcher.js";
import { states } from "./states.js";
import * as utils from "../Utils/util.js";
import { MessageTypes } from "../msgTypes/dBMessageTypes.js";
import { dBError } from "../exception/errorMessages.js";


export class ConnectionState {
  constructor(dBCoreObject) {
    this._state = "";
    this._isconnected = false;
    this._NoChangeEvents = undefined;
    this._supportedEvents = ["connect_error", "connected", "disconnected",
      "reconnecting", "connecting", "state_change",
      "reconnect_error", "reconnect_failed", "reconnected",
      "connection_break", "rttpong"];
         
    this._registry = new dispatcher();
    this._newLifeCycle = true;
    this.reconnect_attempt = 0;
    this._dbcore = dBCoreObject;
    this._rttms = undefined;
  }

  get rttms() {
    return this._rttms;
  }

  get state() {
    return this._state;
  }

  set state(value){
    this._state = value;
  }

  get isconnected(){
    return this._isconnected;
  }


  rttping(payload = null) {
    const now = new Date();
    const t1 = now.getTime();
    let m_status = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.SYSTEM_MSG, null, null, payload, "rttping", null, t1);
    if (!m_status) throw (new dBError("E011"));
  }

  set_newLifeCycle(value) {
    this._newLifeCycle = value;
  }

  get_newLifeCycle() {
    return this._newLifeCycle;
  }

  bind(eventName, callback) {
    if (!(eventName)) throw (new dBError("E012"));

    if (!(callback)) throw (new dBError("E013"));

    if (!(typeof eventName === "string")) throw (new dBError("E012"));

    if (!(this._supportedEvents.includes(eventName))) throw (new dBError("E012"));

    if (!(typeof callback === "function")) throw (new dBError("E013"));

    this._registry.bind(eventName, callback);

  }

  unbind(eventName, callback) {
    this._registry.unbind(eventName, callback);
  }


  _updatestates(eventName) {
    switch (eventName) {
    case states.CONNECTED:
    case states.RECONNECTED:
    case states.RTTPONG:
    case states.RTTPING:
      this._isconnected = true;
      break;
    default:
      this._isconnected = false;
      break;
    }
  }

  _handledispatcher(eventName, eventInfo) {
    let previous = this._state;
    if (!["reconnect_attempt", "rttpong", "rttping"].includes(eventName)) this._state = eventName; this._state = eventName;

    this._updatestates(eventName);

    if (eventName != previous) { 
      if (!["reconnect_attempt", "rttpong", "rttping"].includes(eventName)) {
        if (!["reconnect_attempt", "rttpong", "rttping"].includes(previous)) {
          let leventInfo = { "previous": previous, "current": eventName };
          this._state = eventName;
          if(eventName == "disconnected"){
            this._state = "";
          }
          this._registry.emit_connectionState(states.STATE_CHANGE, leventInfo);
        }
      }
    }

    if (eventInfo) {
      this._registry.emit_connectionState(eventName, eventInfo);
    } else {
      this._registry.emit_connectionState(eventName);
    }

    if (eventName == "reconnected") {
      this._state = "connected";
    }

  }

}
