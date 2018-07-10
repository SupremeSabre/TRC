var $ = jq;
/*!
 * jQuery Form Plugin
 * version: 3.50.0-2014.02.05
 * Requires jQuery v1.5 or later
 * Copyright (c) 2013 M. Alsup
 * Examples and documentation at: http://malsup.com/jquery/form/
 * Project repository: https://github.com/malsup/form
 * Dual licensed under the MIT and GPL licenses.
 * https://github.com/malsup/form#copyright-and-license
 */
/*global ActiveXObject */

// AMD support
(function (factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // using AMD; register as anon module
        define(['jquery'], factory);
    } else {
        // no AMD; invoke directly
        factory( (typeof(jQuery) != 'undefined') ? jQuery : window.Zepto );
    }
}

(function($) {
"use strict";

/*
    Usage Note:
    -----------
    Do not use both ajaxSubmit and ajaxForm on the same form.  These
    functions are mutually exclusive.  Use ajaxSubmit if you want
    to bind your own submit handler to the form.  For example,

    $(document).ready(function() {
        $('#myForm').on('submit', function(e) {
            e.preventDefault(); // <-- important
            $(this).ajaxSubmit({
                target: '#output'
            });
        });
    });

    Use ajaxForm when you want the plugin to manage all the event binding
    for you.  For example,

    $(document).ready(function() {
        $('#myForm').ajaxForm({
            target: '#output'
        });
    });

    You can also use ajaxForm with delegation (requires jQuery v1.7+), so the
    form does not have to exist when you invoke ajaxForm:

    $('#myForm').ajaxForm({
        delegation: true,
        target: '#output'
    });

    When using ajaxForm, the ajaxSubmit function will be invoked for you
    at the appropriate time.
*/

/**
 * Feature detection
 */
var feature = {};
feature.fileapi = $("<input type='file'/>").get(0).files !== undefined;
feature.formdata = window.FormData !== undefined;

var hasProp = !!$.fn.prop;

// attr2 uses prop when it can but checks the return type for
// an expected string.  this accounts for the case where a form 
// contains inputs with names like "action" or "method"; in those
// cases "prop" returns the element
$.fn.attr2 = function() {
    if ( ! hasProp ) {
        return this.attr.apply(this, arguments);
    }
    var val = this.prop.apply(this, arguments);
    if ( ( val && val.jquery ) || typeof val === 'string' ) {
        return val;
    }
    return this.attr.apply(this, arguments);
};

/**
 * ajaxSubmit() provides a mechanism for immediately submitting
 * an HTML form using AJAX.
 */
$.fn.ajaxSubmit = function(options) {
    /*jshint scripturl:true */

    // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
    if (!this.length) {
        log('ajaxSubmit: skipping submit process - no element selected');
        return this;
    }

    var method, action, url, $form = this;

    if (typeof options == 'function') {
        options = { success: options };
    }
    else if ( options === undefined ) {
        options = {};
    }

    method = options.type || this.attr2('method');
    action = options.url  || this.attr2('action');

    url = (typeof action === 'string') ? $.trim(action) : '';
    url = url || window.location.href || '';
    if (url) {
        // clean url (don't include hash vaue)
        url = (url.match(/^([^#]+)/)||[])[1];
    }

    options = $.extend(true, {
        url:  url,
        success: $.ajaxSettings.success,
        type: method || $.ajaxSettings.type,
        iframeSrc: /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank'
    }, options);

    // hook for manipulating the form data before it is extracted;
    // convenient for use with rich editors like tinyMCE or FCKEditor
    var veto = {};
    this.trigger('form-pre-serialize', [this, options, veto]);
    if (veto.veto) {
        log('ajaxSubmit: submit vetoed via form-pre-serialize trigger');
        return this;
    }

    // provide opportunity to alter form data before it is serialized
    if (options.beforeSerialize && options.beforeSerialize(this, options) === false) {
        log('ajaxSubmit: submit aborted via beforeSerialize callback');
        return this;
    }

    var traditional = options.traditional;
    if ( traditional === undefined ) {
        traditional = $.ajaxSettings.traditional;
    }

    var elements = [];
    var qx, a = this.formToArray(options.semantic, elements);
    if (options.data) {
        options.extraData = options.data;
        qx = $.param(options.data, traditional);
    }

    // give pre-submit callback an opportunity to abort the submit
    if (options.beforeSubmit && options.beforeSubmit(a, this, options) === false) {
        log('ajaxSubmit: submit aborted via beforeSubmit callback');
        return this;
    }

    // fire vetoable 'validate' event
    this.trigger('form-submit-validate', [a, this, options, veto]);
    if (veto.veto) {
        log('ajaxSubmit: submit vetoed via form-submit-validate trigger');
        return this;
    }

    var q = $.param(a, traditional);
    if (qx) {
        q = ( q ? (q + '&' + qx) : qx );
    }
    if (options.type.toUpperCase() == 'GET') {
        options.url += (options.url.indexOf('?') >= 0 ? '&' : '?') + q;
        options.data = null;  // data is null for 'get'
    }
    else {
        options.data = q; // data is the query string for 'post'
    }

    var callbacks = [];
    if (options.resetForm) {
        callbacks.push(function() { $form.resetForm(); });
    }
    if (options.clearForm) {
        callbacks.push(function() { $form.clearForm(options.includeHidden); });
    }

    // perform a load on the target only if dataType is not provided
    if (!options.dataType && options.target) {
        var oldSuccess = options.success || function(){};
        callbacks.push(function(data) {
            var fn = options.replaceTarget ? 'replaceWith' : 'html';
            $(options.target)[fn](data).each(oldSuccess, arguments);
        });
    }
    else if (options.success) {
        callbacks.push(options.success);
    }

    options.success = function(data, status, xhr) { // jQuery 1.4+ passes xhr as 3rd arg
        var context = options.context || this ;    // jQuery 1.4+ supports scope context
        for (var i=0, max=callbacks.length; i < max; i++) {
            callbacks[i].apply(context, [data, status, xhr || $form, $form]);
        }
    };

    if (options.error) {
        var oldError = options.error;
        options.error = function(xhr, status, error) {
            var context = options.context || this;
            oldError.apply(context, [xhr, status, error, $form]);
        };
    }

     if (options.complete) {
        var oldComplete = options.complete;
        options.complete = function(xhr, status) {
            var context = options.context || this;
            oldComplete.apply(context, [xhr, status, $form]);
        };
    }

    // are there files to upload?

    // [value] (issue #113), also see comment:
    // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
    var fileInputs = $('input[type=file]:enabled', this).filter(function() { return $(this).val() !== ''; });

    var hasFileInputs = fileInputs.length > 0;
    var mp = 'multipart/form-data';
    var multipart = ($form.attr('enctype') == mp || $form.attr('encoding') == mp);

    var fileAPI = feature.fileapi && feature.formdata;
    log("fileAPI :" + fileAPI);
    var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

    var jqxhr;

    // options.iframe allows user to force iframe mode
    // 06-NOV-09: now defaulting to iframe mode if file input is detected
    if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
        // hack to fix Safari hang (thanks to Tim Molendijk for this)
        // see:  http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
        if (options.closeKeepAlive) {
            $.get(options.closeKeepAlive, function() {
                jqxhr = fileUploadIframe(a);
            });
        }
        else {
            jqxhr = fileUploadIframe(a);
        }
    }
    else if ((hasFileInputs || multipart) && fileAPI) {
        jqxhr = fileUploadXhr(a);
    }
    else {
        jqxhr = $.ajax(options);
    }

    $form.removeData('jqxhr').data('jqxhr', jqxhr);

    // clear element array
    for (var k=0; k < elements.length; k++) {
        elements[k] = null;
    }

    // fire 'notify' event
    this.trigger('form-submit-notify', [this, options]);
    return this;

    // utility fn for deep serialization
    function deepSerialize(extraData){
        var serialized = $.param(extraData, options.traditional).split('&');
        var len = serialized.length;
        var result = [];
        var i, part;
        for (i=0; i < len; i++) {
            // #252; undo param space replacement
            serialized[i] = serialized[i].replace(/\+/g,' ');
            part = serialized[i].split('=');
            // #278; use array instead of object storage, favoring array serializations
            result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
        }
        return result;
    }

     // XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
    function fileUploadXhr(a) {
        var formdata = new FormData();

        for (var i=0; i < a.length; i++) {
            formdata.append(a[i].name, a[i].value);
        }

        if (options.extraData) {
            var serializedData = deepSerialize(options.extraData);
            for (i=0; i < serializedData.length; i++) {
                if (serializedData[i]) {
                    formdata.append(serializedData[i][0], serializedData[i][1]);
                }
            }
        }

        options.data = null;

        var s = $.extend(true, {}, $.ajaxSettings, options, {
            contentType: false,
            processData: false,
            cache: false,
            type: method || 'POST'
        });

        if (options.uploadProgress) {
            // workaround because jqXHR does not expose upload property
            s.xhr = function() {
                var xhr = $.ajaxSettings.xhr();
                if (xhr.upload) {
                    xhr.upload.addEventListener('progress', function(event) {
                        var percent = 0;
                        var position = event.loaded || event.position; /*event.position is deprecated*/
                        var total = event.total;
                        if (event.lengthComputable) {
                            percent = Math.ceil(position / total * 100);
                        }
                        options.uploadProgress(event, position, total, percent);
                    }, false);
                }
                return xhr;
            };
        }

        s.data = null;
        var beforeSend = s.beforeSend;
        s.beforeSend = function(xhr, o) {
            //Send FormData() provided by user
            if (options.formData) {
                o.data = options.formData;
            }
            else {
                o.data = formdata;
            }
            if(beforeSend) {
                beforeSend.call(this, xhr, o);
            }
        };
        return $.ajax(s);
    }

    // private function for handling file uploads (hat tip to YAHOO!)
    function fileUploadIframe(a) {
        var form = $form[0], el, i, s, g, id, $io, io, xhr, sub, n, timedOut, timeoutHandle;
        var deferred = $.Deferred();

        // #341
        deferred.abort = function(status) {
            xhr.abort(status);
        };

        if (a) {
            // ensure that every serialized input is still enabled
            for (i=0; i < elements.length; i++) {
                el = $(elements[i]);
                if ( hasProp ) {
                    el.prop('disabled', false);
                }
                else {
                    el.removeAttr('disabled');
                }
            }
        }

        s = $.extend(true, {}, $.ajaxSettings, options);
        s.context = s.context || s;
        id = 'jqFormIO' + (new Date().getTime());
        if (s.iframeTarget) {
            $io = $(s.iframeTarget);
            n = $io.attr2('name');
            if (!n) {
                $io.attr2('name', id);
            }
            else {
                id = n;
            }
        }
        else {
            $io = $('<iframe name="' + id + '" src="'+ s.iframeSrc +'" />');
            $io.css({ position: 'absolute', top: '-1000px', left: '-1000px' });
        }
        io = $io[0];


        xhr = { // mock object
            aborted: 0,
            responseText: null,
            responseXML: null,
            status: 0,
            statusText: 'n/a',
            getAllResponseHeaders: function() {},
            getResponseHeader: function() {},
            setRequestHeader: function() {},
            abort: function(status) {
                var e = (status === 'timeout' ? 'timeout' : 'aborted');
                log('aborting upload... ' + e);
                this.aborted = 1;

                try { // #214, #257
                    if (io.contentWindow.document.execCommand) {
                        io.contentWindow.document.execCommand('Stop');
                    }
                }
                catch(ignore) {}

                $io.attr('src', s.iframeSrc); // abort op in progress
                xhr.error = e;
                if (s.error) {
                    s.error.call(s.context, xhr, e, status);
                }
                if (g) {
                    $.event.trigger("ajaxError", [xhr, s, e]);
                }
                if (s.complete) {
                    s.complete.call(s.context, xhr, e);
                }
            }
        };

        g = s.global;
        // trigger ajax global events so that activity/block indicators work like normal
        if (g && 0 === $.active++) {
            $.event.trigger("ajaxStart");
        }
        if (g) {
            $.event.trigger("ajaxSend", [xhr, s]);
        }

        if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
            if (s.global) {
                $.active--;
            }
            deferred.reject();
            return deferred;
        }
        if (xhr.aborted) {
            deferred.reject();
            return deferred;
        }

        // add submitting element to data if we know it
        sub = form.clk;
        if (sub) {
            n = sub.name;
            if (n && !sub.disabled) {
                s.extraData = s.extraData || {};
                s.extraData[n] = sub.value;
                if (sub.type == "image") {
                    s.extraData[n+'.x'] = form.clk_x;
                    s.extraData[n+'.y'] = form.clk_y;
                }
            }
        }

        var CLIENT_TIMEOUT_ABORT = 1;
        var SERVER_ABORT = 2;
                
        function getDoc(frame) {
            /* it looks like contentWindow or contentDocument do not
             * carry the protocol property in ie8, when running under ssl
             * frame.document is the only valid response document, since
             * the protocol is know but not on the other two objects. strange?
             * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
             */
            
            var doc = null;
            
            // IE8 cascading access check
            try {
                if (frame.contentWindow) {
                    doc = frame.contentWindow.document;
                }
            } catch(err) {
                // IE8 access denied under ssl & missing protocol
                log('cannot get iframe.contentWindow document: ' + err);
            }

            if (doc) { // successful getting content
                return doc;
            }

            try { // simply checking may throw in ie8 under ssl or mismatched protocol
                doc = frame.contentDocument ? frame.contentDocument : frame.document;
            } catch(err) {
                // last attempt
                log('cannot get iframe.contentDocument: ' + err);
                doc = frame.document;
            }
            return doc;
        }

        // Rails CSRF hack (thanks to Yvan Barthelemy)
        var csrf_token = $('meta[name=csrf-token]').attr('content');
        var csrf_param = $('meta[name=csrf-param]').attr('content');
        if (csrf_param && csrf_token) {
            s.extraData = s.extraData || {};
            s.extraData[csrf_param] = csrf_token;
        }

        // take a breath so that pending repaints get some cpu time before the upload starts
        function doSubmit() {
            // make sure form attrs are set
            var t = $form.attr2('target'), 
                a = $form.attr2('action'), 
                mp = 'multipart/form-data',
                et = $form.attr('enctype') || $form.attr('encoding') || mp;

            // update form attrs in IE friendly way
            form.setAttribute('target',id);
            if (!method || /post/i.test(method) ) {
                form.setAttribute('method', 'POST');
            }
            if (a != s.url) {
                form.setAttribute('action', s.url);
            }

            // ie borks in some cases when setting encoding
            if (! s.skipEncodingOverride && (!method || /post/i.test(method))) {
                $form.attr({
                    encoding: 'multipart/form-data',
                    enctype:  'multipart/form-data'
                });
            }

            // support timout
            if (s.timeout) {
                timeoutHandle = setTimeout(function() { timedOut = true; cb(CLIENT_TIMEOUT_ABORT); }, s.timeout);
            }

            // look for server aborts
            function checkState() {
                try {
                    var state = getDoc(io).readyState;
                    log('state = ' + state);
                    if (state && state.toLowerCase() == 'uninitialized') {
                        setTimeout(checkState,50);
                    }
                }
                catch(e) {
                    log('Server abort: ' , e, ' (', e.name, ')');
                    cb(SERVER_ABORT);
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                    timeoutHandle = undefined;
                }
            }

            // add "extra" data to form if provided in options
            var extraInputs = [];
            try {
                if (s.extraData) {
                    for (var n in s.extraData) {
                        if (s.extraData.hasOwnProperty(n)) {
                           // if using the $.param format that allows for multiple values with the same name
                           if($.isPlainObject(s.extraData[n]) && s.extraData[n].hasOwnProperty('name') && s.extraData[n].hasOwnProperty('value')) {
                               extraInputs.push(
                               $('<input type="hidden" name="'+s.extraData[n].name+'">').val(s.extraData[n].value)
                                   .appendTo(form)[0]);
                           } else {
                               extraInputs.push(
                               $('<input type="hidden" name="'+n+'">').val(s.extraData[n])
                                   .appendTo(form)[0]);
                           }
                        }
                    }
                }

                if (!s.iframeTarget) {
                    // add iframe to doc and submit the form
                    $io.appendTo('body');
                }
                if (io.attachEvent) {
                    io.attachEvent('onload', cb);
                }
                else {
                    io.addEventListener('load', cb, false);
                }
                setTimeout(checkState,15);

                try {
                    form.submit();
                } catch(err) {
                    // just in case form has element with name/id of 'submit'
                    var submitFn = document.createElement('form').submit;
                    submitFn.apply(form);
                }
            }
            finally {
                // reset attrs and remove "extra" input elements
                form.setAttribute('action',a);
                form.setAttribute('enctype', et); // #380
                if(t) {
                    form.setAttribute('target', t);
                } else {
                    $form.removeAttr('target');
                }
                $(extraInputs).remove();
            }
        }

        if (s.forceSync) {
            doSubmit();
        }
        else {
            setTimeout(doSubmit, 10); // this lets dom updates render
        }

        var data, doc, domCheckCount = 50, callbackProcessed;

        function cb(e) {
            if (xhr.aborted || callbackProcessed) {
                return;
            }
            
            doc = getDoc(io);
            if(!doc) {
                log('cannot access response document');
                e = SERVER_ABORT;
            }
            if (e === CLIENT_TIMEOUT_ABORT && xhr) {
                xhr.abort('timeout');
                deferred.reject(xhr, 'timeout');
                return;
            }
            else if (e == SERVER_ABORT && xhr) {
                xhr.abort('server abort');
                deferred.reject(xhr, 'error', 'server abort');
                return;
            }

            if (!doc || doc.location.href == s.iframeSrc) {
                // response not received yet
                if (!timedOut) {
                    return;
                }
            }
            if (io.detachEvent) {
                io.detachEvent('onload', cb);
            }
            else {
                io.removeEventListener('load', cb, false);
            }

            var status = 'success', errMsg;
            try {
                if (timedOut) {
                    throw 'timeout';
                }

                var isXml = s.dataType == 'xml' || doc.XMLDocument || $.isXMLDoc(doc);
                log('isXml='+isXml);
                if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
                    if (--domCheckCount) {
                        // in some browsers (Opera) the iframe DOM is not always traversable when
                        // the onload callback fires, so we loop a bit to accommodate
                        log('requeing onLoad callback, DOM not available');
                        setTimeout(cb, 250);
                        return;
                    }
                    // let this fall through because server response could be an empty document
                    //log('Could not access iframe DOM after mutiple tries.');
                    //throw 'DOMException: not available';
                }

                //log('response detected');
                var docRoot = doc.body ? doc.body : doc.documentElement;
                xhr.responseText = docRoot ? docRoot.innerHTML : null;
                xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
                if (isXml) {
                    s.dataType = 'xml';
                }
                xhr.getResponseHeader = function(header){
                    var headers = {'content-type': s.dataType};
                    return headers[header.toLowerCase()];
                };
                // support for XHR 'status' & 'statusText' emulation :
                if (docRoot) {
                    xhr.status = Number( docRoot.getAttribute('status') ) || xhr.status;
                    xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
                }

                var dt = (s.dataType || '').toLowerCase();
                var scr = /(json|script|text)/.test(dt);
                if (scr || s.textarea) {
                    // see if user embedded response in textarea
                    var ta = doc.getElementsByTagName('textarea')[0];
                    if (ta) {
                        xhr.responseText = ta.value;
                        // support for XHR 'status' & 'statusText' emulation :
                        xhr.status = Number( ta.getAttribute('status') ) || xhr.status;
                        xhr.statusText = ta.getAttribute('statusText') || xhr.statusText;
                    }
                    else if (scr) {
                        // account for browsers injecting pre around json response
                        var pre = doc.getElementsByTagName('pre')[0];
                        var b = doc.getElementsByTagName('body')[0];
                        if (pre) {
                            xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
                        }
                        else if (b) {
                            xhr.responseText = b.textContent ? b.textContent : b.innerText;
                        }
                    }
                }
                else if (dt == 'xml' && !xhr.responseXML && xhr.responseText) {
                    xhr.responseXML = toXml(xhr.responseText);
                }

                try {
                    data = httpData(xhr, dt, s);
                }
                catch (err) {
                    status = 'parsererror';
                    xhr.error = errMsg = (err || status);
                }
            }
            catch (err) {
                log('error caught: ',err);
                status = 'error';
                xhr.error = errMsg = (err || status);
            }

            if (xhr.aborted) {
                log('upload aborted');
                status = null;
            }

            if (xhr.status) { // we've set xhr.status
                status = (xhr.status >= 200 && xhr.status < 300 || xhr.status === 304) ? 'success' : 'error';
            }

            // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
            if (status === 'success') {
                if (s.success) {
                    s.success.call(s.context, data, 'success', xhr);
                }
                deferred.resolve(xhr.responseText, 'success', xhr);
                if (g) {
                    $.event.trigger("ajaxSuccess", [xhr, s]);
                }
            }
            else if (status) {
                if (errMsg === undefined) {
                    errMsg = xhr.statusText;
                }
                if (s.error) {
                    s.error.call(s.context, xhr, status, errMsg);
                }
                deferred.reject(xhr, 'error', errMsg);
                if (g) {
                    $.event.trigger("ajaxError", [xhr, s, errMsg]);
                }
            }

            if (g) {
                $.event.trigger("ajaxComplete", [xhr, s]);
            }

            if (g && ! --$.active) {
                $.event.trigger("ajaxStop");
            }

            if (s.complete) {
                s.complete.call(s.context, xhr, status);
            }

            callbackProcessed = true;
            if (s.timeout) {
                clearTimeout(timeoutHandle);
            }

            // clean up
            setTimeout(function() {
                if (!s.iframeTarget) {
                    $io.remove();
                }
                else { //adding else to clean up existing iframe response.
                    $io.attr('src', s.iframeSrc);
                }
                xhr.responseXML = null;
            }, 100);
        }

        var toXml = $.parseXML || function(s, doc) { // use parseXML if available (jQuery 1.5+)
            if (window.ActiveXObject) {
                doc = new ActiveXObject('Microsoft.XMLDOM');
                doc.async = 'false';


                doc.loadXML(s);
            }
            else {
                doc = (new DOMParser()).parseFromString(s, 'text/xml');
            }
            return (doc && doc.documentElement && doc.documentElement.nodeName != 'parsererror') ? doc : null;
        };
        var parseJSON = $.parseJSON || function(s) {
            /*jslint evil:true */
            return window['eval']('(' + s + ')');
        };

        var httpData = function( xhr, type, s ) { // mostly lifted from jq1.4.4

            var ct = xhr.getResponseHeader('content-type') || '',
                xml = type === 'xml' || !type && ct.indexOf('xml') >= 0,
                data = xml ? xhr.responseXML : xhr.responseText;

            if (xml && data.documentElement.nodeName === 'parsererror') {
                if ($.error) {
                    $.error('parsererror');
                }
            }
            if (s && s.dataFilter) {
                data = s.dataFilter(data, type);
            }
            if (typeof data === 'string') {
                if (type === 'json' || !type && ct.indexOf('json') >= 0) {
                    data = parseJSON(data);
                } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                    $.globalEval(data);
                }
            }
            return data;
        };

        return deferred;
    }
};

/**
 * ajaxForm() provides a mechanism for fully automating form submission.
 *
 * The advantages of using this method instead of ajaxSubmit() are:
 *
 * 1: This method will include coordinates for <input type="image" /> elements (if the element
 *    is used to submit the form).
 * 2. This method will include the submit element's name/value data (for the element that was
 *    used to submit the form).
 * 3. This method binds the submit() method to the form for you.
 *
 * The options argument for ajaxForm works exactly as it does for ajaxSubmit.  ajaxForm merely
 * passes the options argument along after properly binding events for submit elements and
 * the form itself.
 */
$.fn.ajaxForm = function(options) {
    options = options || {};
    options.delegation = options.delegation && $.isFunction($.fn.on);

    // in jQuery 1.3+ we can fix mistakes with the ready state
    if (!options.delegation && this.length === 0) {
        var o = { s: this.selector, c: this.context };
        if (!$.isReady && o.s) {
            log('DOM not ready, queuing ajaxForm');
            $(function() {
                $(o.s,o.c).ajaxForm(options);
            });
            return this;
        }
        // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
        log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
        return this;
    }

    if ( options.delegation ) {
        $(document)
            .off('submit.form-plugin', this.selector, doAjaxSubmit)
            .off('click.form-plugin', this.selector, captureSubmittingElement)
            .on('submit.form-plugin', this.selector, options, doAjaxSubmit)
            .on('click.form-plugin', this.selector, options, captureSubmittingElement);
        return this;
    }

    return this.ajaxFormUnbind()
        .bind('submit.form-plugin', options, doAjaxSubmit)
        .bind('click.form-plugin', options, captureSubmittingElement);
};

// private event handlers
function doAjaxSubmit(e) {
    /*jshint validthis:true */
    var options = e.data;
    if (!e.isDefaultPrevented()) { // if event has been canceled, don't proceed
        e.preventDefault();
        $(e.target).ajaxSubmit(options); // #365
    }
}

function captureSubmittingElement(e) {
    /*jshint validthis:true */
    var target = e.target;
    var $el = $(target);
    if (!($el.is("[type=submit],[type=image]"))) {
        // is this a child element of the submit el?  (ex: a span within a button)
        var t = $el.closest('[type=submit]');
        if (t.length === 0) {
            return;
        }
        target = t[0];
    }
    var form = this;
    form.clk = target;
    if (target.type == 'image') {
        if (e.offsetX !== undefined) {
            form.clk_x = e.offsetX;
            form.clk_y = e.offsetY;
        } else if (typeof $.fn.offset == 'function') {
            var offset = $el.offset();
            form.clk_x = e.pageX - offset.left;
            form.clk_y = e.pageY - offset.top;
        } else {
            form.clk_x = e.pageX - target.offsetLeft;
            form.clk_y = e.pageY - target.offsetTop;
        }
    }
    // clear form vars
    setTimeout(function() { form.clk = form.clk_x = form.clk_y = null; }, 100);
}


// ajaxFormUnbind unbinds the event handlers that were bound by ajaxForm
$.fn.ajaxFormUnbind = function() {
    return this.unbind('submit.form-plugin click.form-plugin');
};

/**
 * formToArray() gathers form element data into an array of objects that can
 * be passed to any of the following ajax functions: $.get, $.post, or load.
 * Each object in the array has both a 'name' and 'value' property.  An example of
 * an array for a simple login form might be:
 *
 * [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
 *
 * It is this array that is passed to pre-submit callback functions provided to the
 * ajaxSubmit() and ajaxForm() methods.
 */
$.fn.formToArray = function(semantic, elements) {
    var a = [];
    if (this.length === 0) {
        return a;
    }

    var form = this[0];
    var formId = this.attr('id');
    var els = semantic ? form.getElementsByTagName('*') : form.elements;
    var els2;

    if (els && !/MSIE [678]/.test(navigator.userAgent)) { // #390
        els = $(els).get();  // convert to standard array
    }

    // #386; account for inputs outside the form which use the 'form' attribute
    if ( formId ) {
        els2 = $(':input[form=' + formId + ']').get();
        if ( els2.length ) {
            els = (els || []).concat(els2);
        }
    }

    if (!els || !els.length) {
        return a;
    }

    var i,j,n,v,el,max,jmax;
    for(i=0, max=els.length; i < max; i++) {
        el = els[i];
        n = el.name;
        if (!n || el.disabled) {
            continue;
        }

        if (semantic && form.clk && el.type == "image") {
            // handle image inputs on the fly when semantic == true
            if(form.clk == el) {
                a.push({name: n, value: $(el).val(), type: el.type });
                a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
            }
            continue;
        }

        v = $.fieldValue(el, true);
        if (v && v.constructor == Array) {
            if (elements) {
                elements.push(el);
            }
            for(j=0, jmax=v.length; j < jmax; j++) {
                a.push({name: n, value: v[j]});
            }
        }
        else if (feature.fileapi && el.type == 'file') {
            if (elements) {
                elements.push(el);
            }
            var files = el.files;
            if (files.length) {
                for (j=0; j < files.length; j++) {
                    a.push({name: n, value: files[j], type: el.type});
                }
            }
            else {
                // #180
                a.push({ name: n, value: '', type: el.type });
            }
        }
        else if (v !== null && typeof v != 'undefined') {
            if (elements) {
                elements.push(el);
            }
            a.push({name: n, value: v, type: el.type, required: el.required});
        }
    }

    if (!semantic && form.clk) {
        // input type=='image' are not found in elements array! handle it here
        var $input = $(form.clk), input = $input[0];
        n = input.name;
        if (n && !input.disabled && input.type == 'image') {
            a.push({name: n, value: $input.val()});
            a.push({name: n+'.x', value: form.clk_x}, {name: n+'.y', value: form.clk_y});
        }
    }
    return a;
};

/**
 * Serializes form data into a 'submittable' string. This method will return a string
 * in the format: name1=value1&amp;name2=value2
 */
$.fn.formSerialize = function(semantic) {
    //hand off to jQuery.param for proper encoding
    return $.param(this.formToArray(semantic));
};

/**
 * Serializes all field elements in the jQuery object into a query string.
 * This method will return a string in the format: name1=value1&amp;name2=value2
 */
$.fn.fieldSerialize = function(successful) {
    var a = [];
    this.each(function() {
        var n = this.name;
        if (!n) {
            return;
        }
        var v = $.fieldValue(this, successful);
        if (v && v.constructor == Array) {
            for (var i=0,max=v.length; i < max; i++) {
                a.push({name: n, value: v[i]});
            }
        }
        else if (v !== null && typeof v != 'undefined') {
            a.push({name: this.name, value: v});
        }
    });
    //hand off to jQuery.param for proper encoding
    return $.param(a);
};

/**
 * Returns the value(s) of the element in the matched set.  For example, consider the following form:
 *
 *  <form><fieldset>
 *      <input name="A" type="text" />
 *      <input name="A" type="text" />
 *      <input name="B" type="checkbox" value="B1" />
 *      <input name="B" type="checkbox" value="B2"/>
 *      <input name="C" type="radio" value="C1" />
 *      <input name="C" type="radio" value="C2" />
 *  </fieldset></form>
 *
 *  var v = $('input[type=text]').fieldValue();
 *  // if no values are entered into the text inputs
 *  v == ['','']
 *  // if values entered into the text inputs are 'foo' and 'bar'
 *  v == ['foo','bar']
 *
 *  var v = $('input[type=checkbox]').fieldValue();
 *  // if neither checkbox is checked
 *  v === undefined
 *  // if both checkboxes are checked
 *  v == ['B1', 'B2']
 *
 *  var v = $('input[type=radio]').fieldValue();
 *  // if neither radio is checked
 *  v === undefined
 *  // if first radio is checked
 *  v == ['C1']
 *
 * The successful argument controls whether or not the field element must be 'successful'
 * (per http://www.w3.org/TR/html4/interact/forms.html#successful-controls).
 * The default value of the successful argument is true.  If this value is false the value(s)
 * for each element is returned.
 *
 * Note: This method *always* returns an array.  If no valid value can be determined the
 *    array will be empty, otherwise it will contain one or more values.
 */
$.fn.fieldValue = function(successful) {
    for (var val=[], i=0, max=this.length; i < max; i++) {
        var el = this[i];
        var v = $.fieldValue(el, successful);
        if (v === null || typeof v == 'undefined' || (v.constructor == Array && !v.length)) {
            continue;
        }
        if (v.constructor == Array) {
            $.merge(val, v);
        }
        else {
            val.push(v);
        }
    }
    return val;
};

/**
 * Returns the value of the field element.
 */
$.fieldValue = function(el, successful) {
    var n = el.name, t = el.type, tag = el.tagName.toLowerCase();
    if (successful === undefined) {
        successful = true;
    }

    if (successful && (!n || el.disabled || t == 'reset' || t == 'button' ||
        (t == 'checkbox' || t == 'radio') && !el.checked ||
        (t == 'submit' || t == 'image') && el.form && el.form.clk != el ||
        tag == 'select' && el.selectedIndex == -1)) {
            return null;
    }

    if (tag == 'select') {
        var index = el.selectedIndex;
        if (index < 0) {
            return null;
        }
        var a = [], ops = el.options;
        var one = (t == 'select-one');
        var max = (one ? index+1 : ops.length);
        for(var i=(one ? index : 0); i < max; i++) {
            var op = ops[i];
            if (op.selected) {
                var v = op.value;
                if (!v) { // extra pain for IE...
                    v = (op.attributes && op.attributes.value && !(op.attributes.value.specified)) ? op.text : op.value;
                }
                if (one) {
                    return v;
                }
                a.push(v);
            }
        }
        return a;
    }
    return $(el).val();
};

/**
 * Clears the form data.  Takes the following actions on the form's input fields:
 *  - input text fields will have their 'value' property set to the empty string
 *  - select elements will have their 'selectedIndex' property set to -1
 *  - checkbox and radio inputs will have their 'checked' property set to false
 *  - inputs of type submit, button, reset, and hidden will *not* be effected
 *  - button elements will *not* be effected
 */
$.fn.clearForm = function(includeHidden) {
    return this.each(function() {
        $('input,select,textarea', this).clearFields(includeHidden);
    });
};

/**
 * Clears the selected form elements.
 */
$.fn.clearFields = $.fn.clearInputs = function(includeHidden) {
    var re = /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list
    return this.each(function() {
        var t = this.type, tag = this.tagName.toLowerCase();
        if (re.test(t) || tag == 'textarea') {
            this.value = '';
        }
        else if (t == 'checkbox' || t == 'radio') {
            this.checked = false;
        }
        else if (tag == 'select') {
            this.selectedIndex = -1;
        }
		else if (t == "file") {
			if (/MSIE/.test(navigator.userAgent)) {
				$(this).replaceWith($(this).clone(true));
			} else {
				$(this).val('');
			}
		}
        else if (includeHidden) {
            // includeHidden can be the value true, or it can be a selector string
            // indicating a special test; for example:
            //  $('#myForm').clearForm('.special:hidden')
            // the above would clean hidden inputs that have the class of 'special'
            if ( (includeHidden === true && /hidden/.test(t)) ||
                 (typeof includeHidden == 'string' && $(this).is(includeHidden)) ) {
                this.value = '';
            }
        }
    });
};

/**
 * Resets the form data.  Causes all form elements to be reset to their original value.
 */
$.fn.resetForm = function() {
    return this.each(function() {
        // guard against an input with the name of 'reset'
        // note that IE reports the reset function as an 'object'
        if (typeof this.reset == 'function' || (typeof this.reset == 'object' && !this.reset.nodeType)) {
            this.reset();
        }
    });
};

/**
 * Enables or disables any matching elements.
 */
$.fn.enable = function(b) {
    if (b === undefined) {
        b = true;
    }
    return this.each(function() {
        this.disabled = !b;
    });
};

/**
 * Checks/unchecks any matching checkboxes or radio buttons and
 * selects/deselects and matching option elements.
 */
$.fn.selected = function(select) {
    if (select === undefined) {
        select = true;
    }
    return this.each(function() {
        var t = this.type;
        if (t == 'checkbox' || t == 'radio') {
            this.checked = select;
        }
        else if (this.tagName.toLowerCase() == 'option') {
            var $sel = $(this).parent('select');
            if (select && $sel[0] && $sel[0].type == 'select-one') {
                // deselect all other options
                $sel.find('option').selected(false);
            }
            this.selected = select;
        }
    });
};

// expose debug var
$.fn.ajaxSubmit.debug = false;

// helper fn for console logging
function log() {
    if (!$.fn.ajaxSubmit.debug) {
        return;
    }
    var msg = '[jquery.form] ' + Array.prototype.join.call(arguments,'');
    if (window.console && window.console.log) {
        window.console.log(msg);
    }
    else if (window.opera && window.opera.postError) {
        window.opera.postError(msg);
    }
}

}));

/*
 *本部分为本站代码，以上部分为第三方插件
 */
var pageParams = {};
	pageParams['loggedIn'] = false;
$(function(){
	pageParams['document']=$(document);
	pageParams['window']=$(window);
	pageParams['w']=pageParams['window'].width();
	pageParams['h']=pageParams['window'].height();
	pageParams['headerSize']= 44;
	//弹出底部更多菜单
	$('.mo-nav-menu-box .more').click(function (){
		var t = $(this).find('div');
		if (t.css('display') == 'none')
			$(this).addClass('selected');
		else
			$(this).removeClass('selected');
		t.fadeToggle();
	});
	//收藏商品
	$('.favorite').click(function (){
		goodsFavorite($(this).attr('gid'));
	});
	//规格
	$('.sku').each(function(i,el){
		$('.sku-item',el).bind('click',function(e){
			selSpec(e,i);
		});
	});
	//加载返回头部
	bottomToTop();
	//刷新购物数量
	refreshCartTotal();
	//主动聊天窗口 停止时间：2017-7-25 红要求
	//chatInvitation.openthechat();
	// app下载提示
	//top_app_upload_guide.init();
	
	// 双十一领取红包弹窗 2017/11/1
	getDouble11Coupon.init();
});

//正在处理效果
var openLoading = function (s){
	if (s == 'show'){
		var hl='<div id="loading-center-absolute"><div class="object" id="object_one"></div><div class="object" id="object_two"></div><div class="object" id="object_three"></div><div class="object" id="object_four"></div></div>';
		$('body').append(hl);
		popupBg(true, 5);
	}
	else{
		$('#loading-center-absolute').remove();
		popupBg(false);
	}
}
//消息通知弹出层
var _alert = function (state, msg, sec){
	//TRUE OR FALSE
	var s = (state)?'succ':'fail';	
	var hl='<div class="mbprogresshud"><p><i class="mo-sprite-icon '+s+'"></i></p><p>'+msg+'</p></div>';
	sec = (sec>0)?sec:3000;
	$('body').append(hl);
	var m = $('.mbprogresshud');
	m.css({'left':(pageParams['w']/2-((m.width()+40)/2)),'top':(pageParams['h']/2-((m.height()+40)/2))});
	m.fadeIn("slow");
	setTimeout(function (){
		m.fadeOut("slow",function (){m.remove()});
	}, sec);
} 
//返回头部
var bottomToTop = function (){
	var hl = '<div class="bottomtotop"><a href="javascript:;"><i class="mo-sprite-icon"></i></a></div>';
	$('body').append(hl);
	pageParams['window'].scroll(function () {
		pageParams['bottomtotop']=$('.bottomtotop');
		s = pageParams['document'].scrollTop();
		if (s >= pageParams['headerSize']) {
			pageParams['bottomtotop'].fadeIn("fast");
		} else {
			pageParams['bottomtotop'].fadeOut("fast");
		}
	});
	navoffset('.bottomtotop', 'header');
}
//导航定位
var navoffset = function (navtab, offset) {
	$(navtab).click(function () {
		var thistop = $(offset).offset().top;
		$('html,body').animate({scrollTop: thistop},1000);
	})
}
//取得购物数量显示
var cart_total = function (t){
	var num = $.cookie('S[CART_NUMBER]');
	if (num > 0){
		$(t).show();
		$(t).text(num);
	} else {
		$(t).hide();	
	}
}
//刷新购物车数量显示
var refreshCartTotal = function (){
	cart_total('.mo-header-box-right-buy-cart i');
}
//客户通代码
//var NTKF_PARAM ={"siteid":"kf_9273" /*网站siteid*/,"settingid":"kf_9273_1468978607339" /*代码ID*/, "uid":"" /*会员ID*/,"uname":""/*会员名*/,"userlevel": "0"/*会员等级*/};
/*var openTheChat = function (){
    if ($('#jsntalker').length > 0){
        NTKF.im_openInPageChat('kf_9273_1468978607339');
    }else{
        if ($('#ntalkerjs').length > 0){
            if ($('#ntalkerjs').val() == '1'){
                NTKF.im_openInPageChat('kf_9273_1468978607339');
            }
        }else{
            $('<input id="ntalkerjs" type="hidden" value="0" />').appendTo('body');
            $.getScript('http://dl.ntalker.com/js/xn6/ntkfstat.js?siteid=kf_9273', function(){
                setTimeout(function(){ $('#ntalkerjs').val('1'); NTKF.im_openInPageChat('kf_9273_1468978607339'); }, 500);
            });
        }
    }
}*/
//页面跳转
var headerUrl = function (url){
	window.location.href=url;
}
//页面按钮转换,btn_login,btn_edit,btn_finish
var showHeaderBtn = function (btn){
	$('.header_right').hide();
	$('.btn_'+btn).show();
}
//产品收藏
var goodsFavorite = function (gid){
	if (gid < 0 ) {
		_alert(false, '收藏参数出错，请联系客服');
	} else if (pageParams['loggedIn']) {
		$.ajax({
			type: 'POST',
			url: '/mobile/member-ajax_fav.html',
			dataType: 'json',
			data:'act_type=add&goods_id='+gid+'&type=goods',
			success: function(e){
				if (e.error)
					_alert(false,e.error);
				else
					_alert(true,e.success);
			},
			error: function(xhr, type){
				_alert(false, '数据错误，请检查网络或者联系客服，错误代码：006');
			}
		});
	} else {
		headerUrl('/mobile/passport-login.html');	
	}
}
//弹窗
var popup = function (state, html){
	var hl = '<div id="popup" style="top:'+pageParams['h']+'px;left:0;position:fixed;z-index:2;width:100%;height:100%;display:none;"><div style="min-width:320px;max-width:640px;margin:0 auto;background:#FFF;width:100%;height:100%;position: relative;overflow: scroll;"></div></div>';
	if ($('#popup').length < 1) {
		$('body').append(hl);
	} 
	var p = $('#popup');
	if (state) {
		p.find('div').html(html);
		p.show('fase',function (){
			p.animate({'top':0}, 'fast');
			});
	} else {
		p.animate({'top':pageParams['h']}, 'fast', function (){p.hide()});	
	}
}
//产品规格
var selSpec = function (e,i){
	var el = $(e.target),
		data = productData,
		pid = el.data('pid'),
		arr = [],
		j = i ? 0 : 1,active, list = $('.sku',document.body);

	if(el.hasClass('disable'))return;
	if(active = $('.active', list.get(i)))
	active.removeClass('active');

	el.addClass('active');
	if(list.length==1)return getProduct(pid);

	var act = $('.active',this.el);
	if(act.length==2 && list.length==2){
	   var str = $(act[0]).data('pid')+':'+$(act[1]).data('pid');
	   getProduct(str);
	}
	if(act.length==3 && list.length==3){
	   var str = $(act[0]).data('pid')+':'+$(act[1]).data('pid')+':'+$(act[2]).data('pid');
	   getProduct(str);
	}
	if(act.length==4 && list.length==4){
	   var str = $(act[0]).data('pid')+':'+$(act[1]).data('pid')+':'+$(act[2]).data('pid')+':'+$(act[3]).data('pid');
	   getProduct(str);
	}
	if(act.length==1&&list.length==1){
	   getProduct(pid);
	}

	data.forEach(function(v,k){
		var pids = v['spec_private_value_id'],
			tpReg = new RegExp(""+pid+"");
		if(tpReg.test(pids)){
			var spec = pids.split(':');
			arr.push(spec[j]);
		}
	});

	$('.sku-item', list.get(j)).each(function(j,elem){
		var k = $(elem).data('pid');
		//$(elem)[!_.include(arr,k)?'addClass':'removeClass']('disable');
	});
}
var getProduct = function(str){
	productData.forEach(function(v,k){
		var pids = v['spec_private_value_id'],
			tpReg = new RegExp(""+str+"");
			mid = $('.mid').attr('value');
		if(tpReg.test(pids)){
			$('.product-info input').attr('value',v.product_id);
			//$('.spec-info,.specblock .sl').text('已选'+v['spec_info']);
			if (mid!="" && mid!=0) {
			  $('.price,.mo-buycart-menu-box-price p').text('￥'+Math.round(v['price']['member_lv_price'][mid]['price']));
			  //$('.spec-content .mktprice,.productSpecTop .mktprice').text('￥'+Math.round(v['price']['mktprice']['price']));
			}else{
			  $('.price,.mo-buycart-menu-box-price p').text('￥'+Math.round(v['price']['price']['current_price']));
			  //$('.spec-content .mktprice,.productSpecTop .mktprice').text('￥'+Math.round(v['price']['mktprice']['price']));
			};
			
		}
	},this);
};
//刷新验证码
var changeimg = function (id, url){
	$('#'+id).attr('src',url+'?'+(+new Date()));	
}
//弹窗透明背景 TRUE OR FALSE
var popupBg = function (s, index){
	var zindex;
	if (index) {
		zindex = index;
	} else {
		zindex = 10000;	
	}
	bgstr = '<div id="ImgZoomInBG" style=" background:#000000; filter:Alpha(Opacity=70); opacity:0.7; position:fixed; left:0; top:0; z-index:'+zindex+'; width:100%; height:100%; display:none;"></div>';
	if ($('#ImgZoomInBG').length < 1) {
		$('body').append(bgstr);
	}
	if (s) {
		$('#ImgZoomInBG').show();
	} else {
		$('#ImgZoomInBG').hide();	
	}	
}
//确认窗口
var _confirm = function (e, title, msg, index){
	var zindex;
	if (index) {
		zindex = index;
	} else {
		zindex = 10000;	
	}
	var html = '<div class="mo-confirem" style="z-index:'+zindex+';"><div class="mo-confirem-content"><p class="title bold">'+title+'</p><p class="msg">'+msg+'</p></div><div class="mo-confirem-button"><p class="cancelBtn f_left"><span>取消</span></p><p class="okBtn f_left maincolor"><span>确定</span></p></div></div>';
	if ($('.mo-confirem').length < 1) {
		$('body').append(html);
	}
	popupBg(true, zindex-1);
	$('.mo-confirem').show().css({'top':(pageParams['h']/2-($('.mo-confirem').height()/2)),'left':(pageParams['w']/2-($('.mo-confirem').width()/2))});
	$('.cancelBtn').click(function (){action.cancelBtn(e);$('.mo-confirem').hide();popupBg();});
	$('.okBtn').click(function (){action.okBtn(e);$('.mo-confirem').hide();popupBg();});
}
//重新加载页面
var _refresh = function (){
	window.location.reload();
}
//定位
var active = {
	navoffset:function (navtab, offset) {
		$(navtab).click(function () {
			var thistop = jq(offset).offset().top;
			jq('html,body').animate({scrollTop: thistop},1000);
		})
	},	
}
//聊天主动邀请
var chatInvitation = {
	t_chat_time : 30000,
	openthechat : function (){
		if ($.cookie('m_marketcusqqstate') == 1) return false;	
		if ($('.openwin').length < 1){
			var html = '<div style=" margin:0 auto;min-width:320px; max-width:640px;display:none" class="openwin">';
				html+='<div style="position:fixed;top:0;width:100%; height:100%;min-width:320px; max-width:640px;z-index:1000;">';
        		html+='<div style="position: absolute;top:25%;left:10%;width:80%;z-index:1002;" class="opwincon">';
            	html+='<img style="display: block;margin: 0 auto;overflow: hidden;width: 100%;" src="/app/mobile/statics/images/openthechat/chat_w1.jpg">';
           		html+='<img style="display: block;margin: 0 auto;overflow: hidden;width: 100%;" class="openQQ" id="BizQQWPAchat" width="100%" src="/app/mobile/statics/images/openthechat/chat_w2.jpg?1">';
            	html+='<img style="display: block;margin: 0 auto;overflow: hidden;width: 100%;" width="100%" src="/app/mobile/statics/images/openthechat/chat_w3.jpg?1">';
           		html+='<div class="wxi" style="position:absolute;bottom:10%;width:100%;">';
				html+='<p class="wxi" style="margin:0 auto;width:27%;"><img width="100%" src="/themes/moissanite/images/weizuanhui-kf.png"></p>';
				html+='<p style="margin:0 auto;width:95%; color:#FFF; font-size:16px; text-align:center;padding-top:10px;">打开微信搜索<span style="padding-left:5px;">weizuanhui-kf</span></p></div>';
            	html+='<div class="close" style="position:absolute; top:0;right:0;width:5%;"><img width="100%" src="/app/mobile/statics/images/openthechat/close.png"></div>';
        		html+='</div>';
        		html+='<div style=" position:absolute;left:0;top:0;width:100%; height:100%; min-width:320px; max-width:640px; background:#000; opacity:0.5;filter:alpha(opacity=50); z-index:1001;" class="opwinbg"></div>';
    			html+='</div>';
				html+='</div>';
			$('body').append(html);
			$.ajax({
				url:'/webcount-online.html',
				data: '',
				type: "get",
				dataType:'json',
				success:function(e){
					if (e.error){
						//客服离线
					}
					else{
						$('.openwin .wxi img').attr('src', '/'+e.wximg);
						$('.openwin').find('span').html(e.wx);
						if ($.cookie('marketcusqqisopen') == 1){
							chatInvitation.t_chat_time = 1800000;
							setTimeout("chatInvitation.openthechatwin()", chatInvitation.t_chat_time);
						}
						else if ($.cookie('marketcusqqisopen') == 2){
							chatInvitation.t_chat_time = 3600000;
							setTimeout("chatInvitation.openthechatwin()", chatInvitation.t_chat_time);
						}
						else{
							setTimeout("chatInvitation.openthechatwin()", 30000);
						}
						//检测其他需要使用微信客服数据
						if(window.weChatOther) {  
							weChatOther(e);  
						}  
					}
				}
			});
			$('.openwin .close').click(function (){
				$('.openwin').hide();
				setTimeout("chatInvitation.openthechatwin(true)", chatInvitation.t_chat_time)
			});
			$('.openwin .openQQ').click(function (){
				openTheChat();
			});
		}
	},
	openthechatwin : function (f){
		if (chatInvitation.t_chat_time == 30000){
			var expiresDate= new Date();
			expiresDate.setTime(expiresDate.getTime() + (24 * 60 * 60 * 1000));
			$.cookie('marketcusqqisopen', '1', {path : '/', expires : expiresDate});
			chatInvitation.t_chat_time = 1800000;
		}
		else if (chatInvitation.t_chat_time == 1800000){
			var expiresDate= new Date();
			expiresDate.setTime(expiresDate.getTime() + (24 * 60 * 60 * 1000));
			$.cookie('marketcusqqisopen', '2', {path : '/', expires : expiresDate});
			chatInvitation.t_chat_time = 3600000;
		}
		$('.openwin').show();
		if (f) chatInvitation.t_chat = setTimeout("chatInvitation.openthechatwin(true)", chatInvitation.t_chat_time);
	}	
}

var top_app_upload_guide = {
	init:function (){
		var u = navigator.userAgent;
		var isiOS = !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/); //ios终端
		if (isiOS == false)  return false;
		if ($.cookie('top_app_upload_guide_state') == 1) return false;
		top_app_upload_guide.display();
	},
	display:function (){
		var html = '<div id="top_app_upload_guide" class="image-block"><a href="javascript:;"><img src ="/app/mobile/statics/images/top_app_upload_guide.jpg" /></a></div>';
		$('header').before(html);
		$('#top_app_upload_guide').click(function (){
			$(this).hide();
			var expiresDate= new Date();
			expiresDate.setTime(expiresDate.getTime() + (365 * 24 * 60 * 60 * 1000));
			$.cookie('top_app_upload_guide_state', '1', {path : '/', expires : expiresDate});
			window.location.href = 'https://itunes.apple.com/cn/app/apple-store/id1230330566';
		});
	},

}

// 双十一领取红包弹窗 2017/11/1
var getDouble11Coupon = {
	init:function (){
		var s =  $.cookie('double11State');
		if (s > 3){
			return false;	
	    } else {
			$('body').append(getDouble11Coupon.html);
			getDouble11Coupon.w=$('.couponWin');
			getDouble11Coupon.o=$('.coupon-open');
			getDouble11Coupon.c=$('.coupon-close');
			getDouble11Coupon.a=$('.couponWina');
			getDouble11Coupon.b=$('.couponWinb');
			
			getDouble11Coupon.o.click(function (){
				getDouble11Coupon.open();
			});	
			getDouble11Coupon.c.click(function (){
				getDouble11Coupon.close();
			});	
			getDouble11Coupon.state();
		}
	},
	open:function (){
		$.get('/product-act-double11.html?act=get_coupon', '', function(result){
			if (result.error == 10000){
				miniLogin.openLogin();
			}
			else if(result.success){
				getDouble11Coupon.a.hide();
				getDouble11Coupon.b.show();
				$.cookie('double11State', 4, { expires: 30,path: '/' });
			}else{
				alert(result.error);
			}
		}, 'json'); 
	},	
	close:function (){
		getDouble11Coupon.w.hide();
		var s = $.cookie('double11State');
		if (s == null) s=1;
		$.cookie('double11State', parseInt(s) + 1, { expires: 30,path: '/' });	
	},
	state:function (){
		$.get('/product-act-double11.html?act=get_coupon_state', '', function(result){
			if (result.error == 10001){
				getDouble11Coupon.w.hide();
			}
			else{
				getDouble11Coupon.w.show();
			}
		}, 'json'); 	
	},
	html:'<div style="position:fixed;width:100%;height:100%;top:0;left:0; z-index:997;display:none;" class="couponWin">'+
	'<div style="background:#000;opacity:0.7;filter:Alpha(opacity=70);width:100%;height:100%;"></div>'+
	'<div class="couponWina" style="position:absolute;top:50%;left:50%;margin:-150px 0 0 -150px;cursor:pointer;"><img class="coupon-open" src="/custom/b2c/statics/double11/images/coupon-win.png" width="320" /><div class="coupon-close" style="position:absolute;width:50px;height:50px;top:0;right:0;"></div></div>'+
	'<div class="couponWinb" style="position:absolute;top:50%;left:50%; margin:-237px 0 0 -150px;cursor:pointer;display:none;"><a href="/m/act/act/double11.html"><img src="/custom/b2c/statics/double11/images/WAPcoupon-succ.jpg" width="320" /></a><div class="coupon-close" style="position:absolute;width:50px;height:50px;top:0;right:0;"></div></div>'+
	'</div>',
	
}