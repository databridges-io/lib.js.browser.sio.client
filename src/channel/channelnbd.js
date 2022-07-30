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
import * as utils from "../Utils/util.js";
import { dispatcher } from "../dispatcher/dispatcher.js";
import { dBError } from "../exception/errorMessages.js";

const connectSupportedEvents = [utils.systemEvents.CONNECT_SUCCESS,
  utils.systemEvents.CONNECT_FAIL,
  utils.systemEvents.RECONNECT_SUCCESS,
  utils.systemEvents.RECONNECT_FAIL,
  utils.systemEvents.DISCONNECT_SUCCESS,
  utils.systemEvents.DISCONNECT_FAIL,
  utils.systemEvents.ONLINE,
  utils.systemEvents.OFFLINE,
  utils.systemEvents.REMOVE,
  utils.systemEvents.PARTICIPANT_JOINED,
  utils.systemEvents.PARTICIPANT_LEFT];


export class channelnbd { 
  constructor(channelName, sid, dBCoreObject) {
    this._channelName = channelName;
    this._dbcore = dBCoreObject;
    this._sid = sid;
    this._dispatch = new dispatcher();
    this._isOnline = false;
  }

  getChannelName() {
    return this._channelName;
  }

  isOnline() {
    return this._isOnline;
  }

  _set_isOnline(value) {
    this._isOnline = value;
  }


  publish(eventName, eventData, seqnum = undefined) {
    if (!this._isOnline) throw (new dBError("E014"));

    if (!eventName) throw (new dBError("E058"));
    if (typeof eventName != "string") throw (new dBError("E059"));


    if (this._channelName.toLowerCase() == "sys:*") throw (new dBError("E015"));

    let m_status = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.PUBLISH_TO_CHANNEL, this._channelName, null, eventData, eventName, null, null, seqnum);

    if (!m_status) throw (new dBError("E014"));
    return;
  }


  bind(eventName, callback) {
    if (connectSupportedEvents.includes(eventName)) {
      this._dispatch.bind(eventName, callback);
    } else {
      throw (new dBError("E103"));
    }
  }

  unbind(eventName, callback) {
    if (connectSupportedEvents.includes(eventName)) {
      if (this._dispatch.isExists(eventName)) this._dispatch.unbind(eventName, callback);
    }
  }

  emit_channel(eventName, EventInfo, channelName, metadata) {
    this._dispatch.emit_channel(eventName, EventInfo, channelName, metadata);
  }

  call(functionName, payload, ttl, callback) {
    return new Promise((resolve, reject) => {
      if (!["channelMemberList", "channelMemberInfo", "timeout", "err"].includes(functionName)) {
        reject(new dBError("E038"));
      } else {
        if (this._channelName.toLowerCase().startsWith("prs:") ||
                    this._channelName.toLowerCase().startsWith("sys:")) {
          let caller = this._dbcore.rpc.ChannelCall(this._channelName);
          caller.call(functionName, payload, ttl, (response) => {
            callback(response);
          })
            .then((response) => {
              resolve(response);
            })
            .catch((error) => {
              reject(error);
            });
        } else {
          reject(new dBError("E039"));
        }
      }
    });
  }
}