(function (window, document, $, chrome) {
    'use strict';

    function htmlEscape(str, noQuotes) {
        var map = [];
        map['&'] = '&amp;';
        map['<'] = '&lt;';
        map['>'] = '&gt;';

        var regex;

        if (noQuotes) {
            regex = /[&<>]/g;
        }
        else {
            map['"'] = '&#34;';
            map["'"] = '&#39;';
            regex = /[&<>"']/g;
        }

        return ('' + str).replace(regex, function (match) {
            return map[match];
        });
    }

    function loading(value) {
        var $loading = $('#loading');
        var $html = $('html');

        if (value) {
            $loading.width($html.width());
            $loading.height($html.height());
            $loading.show();
        }
        else {
            $loading.hide();
        }
    }

    function getTab(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tab) {
            callback(tab[0].id, tab[0].url);
        });
    }

    function executeScript(msg, callback) {
        getTab(function (tabId) {
            var exec = chrome.tabs.executeScript;

            exec(tabId, { code: 'var msg = ' + JSON.stringify(msg) }, function () {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError.message);
                    callback && callback(undefined);
                    return;
                }

                exec(tabId, { file: 'inject.js' }, function (response) {
                    callback && callback(response[0]);
                });
            });
        });
    }

    function noData() {
        var pClass;
        var promptText;

        if (type === 'Local') {
            pClass = 'localstorage';
            promptText = 'local';
        }
        else if (type === 'Session') {
            pClass = 'sessionstorage';
            promptText = 'session';
        } else {
            pClass = 'Cookies';
            promptText = 'cookie';
        }
        return '<p class="' + pClass + '">该页面暂无任何 ' + promptText + ' Storage相关 数据~</p>';
    }
    //------------------------------------------------------------------------------

    var type;
    var $type = $('#type');

    if (localStorage['type'] === 'Local' || localStorage['type'] === undefined) {
        // var headHTML = document.getElementsByTagName('head')[0].innerHTML;
        // headHTML += '<link rel="stylesheet" href="style.css">';
        // document.getElementsByTagName('head')[0].innerHTML = headHTML;
        $('#main').show();
        $('#test').hide();
        type = 'Local';
        $type.attr('class', 'localstorage').html('Local');
    }
    else if (localStorage['type'] === 'Session') {
        type = 'Session';
        $type.attr('class', 'sessionstorage').html('Session');
        $('#main').show();
        $('#test').hide();
    } else {
        type = 'Cookies';
        $type.attr('class', 'cookies').html('Cookies');
        $('#main').hide();
        $('#test').show();
    }

    executeScript({ what: 'get', type: type }, function (response) {
        var storage = response;
        var str = '';
        var key;
        var value;
        var size = 0;
        var tableClass = type === 'Local' ? 'localstorage' : 'sessionstorage';

        if (storage === undefined) {
            str = '<p class="error">很抱歉，该页面暂无 Storage & Cookies 相关数据哦~ </p>';
        }
        else {
            str += '<table class="' + tableClass + '">';
            str += '<thead>';
            str += '<tr>';
            str += '<th class="td-nome">键</th>';
            str += '<th class="td-value" colspan="3">值</th>';
            str += '</tr>';
            str += '</thead>';
            str += '<tbody>';

            for (var i in storage) {
                key = htmlEscape(i);
                value = htmlEscape(storage[i]);

                str += '<tr>';
                str += '<td class="td-nome"><input type="text" value="';
                str += key + '" data-key="' + key + '"></td>';
                str += '<td class="td-value"><textarea rows="2" type="textarea" class="valueinput">';
                str += value + '</textarea></td>';
                str += '<td class="td-icon minus"><img src="img/del.png"></td>';
                str += '</tr>';

                size++;
            }

            str += '</tbody></table>';

            if (!size) {
                str = noData();
            }
        }

        $('#table').html(str);
    });

    $('#type').on('click', function () {
        if ($(this).html() === 'Local') {
            localStorage['type'] = 'Session';
        }
        else if ($(this).html() === 'Session') {
            localStorage['type'] = 'Cookies';
        } else {
            localStorage['type'] = 'Local';
        }

        location.reload();
    });


    $('#add').on('click', function (e) {
        e.preventDefault();

        var key;
        var value;

        key = prompt('请输入您要输入的-Key:');

        if (key === null) {
            return;
        }

        value = prompt('请输入您要输入的-Value:');

        if (value === null) {
            return;
        }

        var message = {
            type: type,
            what: 'set',
            key: key,
            value: value
        };

        executeScript(message, function () {
            location.reload();
        });
    });

    $('#clear').on('click', function (e) {
        e.preventDefault();
        executeScript({ type: type, what: 'clear' }, function () {
            location.reload();
        });
    });


    $('#download').on('click', function (e) {
        e.preventDefault();

        loading(true);

        getTab(function (tabId, tabUrl) {
            var host = tabUrl.split('/')[2];

            function zero(n) {
                return n < 10 ? '0' + n : n;
            }

            var d = new Date;
            var date = [zero(d.getFullYear()), zero(d.getMonth() + 1),
            zero(d.getDate())].join('-') + '_' + [zero(d.getHours()),
            zero(d.getMinutes()), zero(d.getSeconds())].join('-');

            var filename = host + '-' + date + '.txt';

            executeScript({ type: type, what: 'export' }, function (response) {

                if (response === undefined) {
                    loading(false);
                    return;
                }
                var iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.onload = function () {
                    var doc = this.contentDocument;
                    var file = new Blob([response]);
                    var a = doc.createElement('a');
                    a.href = window.URL.createObjectURL(file);
                    a.download = filename;
                    a.style.display = 'none';
                    doc.body.appendChild(a);
                    a.click();
                };
                document.body.appendChild(iframe);

                loading(false);
            });
        });

    });


    $('#copy').on('click', function (e) {
        e.preventDefault();

        loading(true);

        executeScript({ type: type, what: 'export' }, function (response) {

            if (response === undefined) {
                loading(false);
                return;
            }

            var e = document.createElement('textarea');
            e.style.position = 'fixed';
            e.style.opacity = 0;
            e.value = response;
            document.body.appendChild(e);
            e.select();
            document.execCommand('copy');
            document.body.removeChild(e);

            loading(false);
        });
    });

    // $('#table').on('input', 'input', function () {
    //     var $this = $(this);
    //     var $parent = $this.parent();
    //     var oldKey;
    //     var key;
    //     var value;
    //     // Editing the value
    //     if ($parent.attr('class') === 'td-value') {
    //         key = $parent.prev().find('input').val();
    //         value = $this.val();
    //     }
    //     // Editing the key
    //     else {
    //         oldKey = $this.data('key');
    //         key = $this.val();
    //         $this.data('key', key);
    //         value = $parent.next().find('input').val();
    //     }
    //     var message = {
    //         type: type,
    //         what: 'set',
    //         oldKey: oldKey,
    //         key: key,
    //         value: value
    //     };
    //     executeScript(message);
    // });

    $('#table').on('input propertychange', 'textarea', function () {
        var $this = $(this);
        var $parent = $this.parent();
        var oldKey;
        var key;
        var value;
        // Editing the value
        if ($parent.attr('class') === 'td-value') {
            key = $parent.prev().find('input').val();
            value = $this.val();
        }
        // Editing the key
        else {
            oldKey = $this.data('key');
            key = $this.val();
            $this.data('key', key);
            value = $parent.next().find('input').val();
        }
        var message = {
            type: type,
            what: 'set',
            oldKey: oldKey,
            key: key,
            value: value
        };
        executeScript(message);
    });



    $('#table').on('click', 'td.td-icon', function () {
        var $this = $(this);

        // minus / open
        var icon = $this.attr('class').split(' ')[1];

        if (icon === 'minus') {

            var $parent = $this.parent();
            var key = $this.prev().prev().find('input').val();

            executeScript({ type: type, what: 'remove', key: key }, function () {
                $parent.fadeOut(100, function () {

                    var siblingsLen = $parent.siblings().length;

                    $parent.remove();
                    // If removed all, removes the table too
                    if (!siblingsLen) {
                        $('#table').html(noData())
                    }
                });
            });
        }
    });

})(window, document, jQuery, chrome);
