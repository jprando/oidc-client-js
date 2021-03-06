// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

import Log from './Log';

const DefaultInterval = 2000;

export default class CheckSessionIFrame {
    constructor(callback, client_id, url, interval) {
        this._callback = callback;
        this._client_id = client_id;
        this._url = url;
        this._interval = interval || DefaultInterval;

        var idx = url.indexOf("/", url.indexOf("//") + 2);
        this._frame_origin = url.substr(0, idx);

        this._frame = window.document.createElement("iframe");

        // shotgun approach
        this._frame.style.visibility = "hidden";
        this._frame.style.position = "absolute";
        this._frame.style.display = "none";
        this._frame.style.width = 0;
        this._frame.style.height = 0;

        this._frame.src = url;
    }
    load() {
        return new Promise((resolve) => {
            this._frame.onload = () => {
                resolve();
            }

            window.document.body.appendChild(this._frame);
            this._boundMessageEvent = this._message.bind(this);
            window.addEventListener("message", this._boundMessageEvent, false);
        });
    }
    _message(e) {
        if (e.origin === this._frame_origin &&
            e.source === this._frame.contentWindow
        ) {
            if (e.data === "error") {
                Log.error("error message from check session op iframe");
                this.stop();
            }
            else if (e.data === "changed") {
                Log.debug("changed message from check session op iframe");
                this.stop();
                this._callback();
            }
            else {
                Log.debug(e.data + " message from check session op iframe");
            }
        }
    }
    start(session_state) {
        if (this._session_state !== session_state) {
            Log.debug("CheckSessionIFrame.start");

            this.stop();

            this._session_state = session_state;

            this._timer = window.setInterval(() => {
                this._frame.contentWindow.postMessage(this._client_id + " " + this._session_state, this._frame_origin);
            }, this._interval);
        }
    }

    stop() {
        Log.debug("CheckSessionIFrame.stop");

        this._session_state = null;

        if (this._timer) {
            window.clearInterval(this._timer);
            this._timer = null;
        }
    }
}
