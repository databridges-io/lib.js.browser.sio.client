/* eslint-disable no-mixed-spaces-and-tabs */

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

export class channel extends dispatcher { 
  constructor(channelName, sid, dBCoreObject) {
	  super();
	  this._channelName = channelName;
	  this._sid = sid;
	  this._dbcore = dBCoreObject;
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

	  if (this._channelName.toLowerCase() == "sys:*") throw (new dBError("E015"));
	  if (!eventName) throw (new dBError("E058"));
	  if (typeof eventName != "string") throw (new dBError("E059"));

	  let m_status = utils.updatedBNewtworkSC(this._dbcore, MessageTypes.PUBLISH_TO_CHANNEL, this._channelName, null, eventData, eventName, null, null, seqnum);

	  if (!m_status) throw (new dBError("E014"));

	  return;
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