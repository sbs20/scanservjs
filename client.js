var Backbone = require('backbone');
var jQuery = require('jquery');
var $ = jQuery;
var _ = require('underscore');
var toastr = require('toastr');

require("jqueryui");
require("jquery-jcrop");
require('backbone.localstorage');

$(document).ready(function () {

    // Set up toastr how we want it
    toastr.options = {
        "positionClass": "toast-bottom-right"
    }

    // Files are always created on the server. All we need here
    // is idAttribute so backbone knows what the id field is
    var File = Backbone.Model.extend({
        idAttribute: "fullname"
    });

    // FileCollections are cery simple but we need to specify
    // the url and model type
    var FileCollection = Backbone.Collection.extend({
        url: 'file',
        model: File
    });

    // ScanRequest is what gets sent to the scanner and contains
    // the various fields which define what the scanner will do
    var ScanRequest = Backbone.Model.extend({

        defaults: function () {
            return {
                // LocalStorage requires an id in order to
                // update / read. This can be fixed to anything
                id: 0,
                top: 0,
                left: 0,
                width: 215,
                height: 297,
                resolution: 150,
                mode: 'Color',
                brightness: 0,
                contrast: 0,
                type: 'tif'
            };
        },

        initialize: function () {
            this.localStorage = new Backbone.LocalStorage('scanservjs');
        }
    });

    // Views
    var FileView = Backbone.View.extend({

        tagName: 'tr',
        template: _.template($('#file-row').html()),
        events: {
            'click button': "clear"
        },

        render: function () {
            var json = this.model.toJSON();
            var html = this.template(json);
            this.$el.html(html);
            return this;
        },

        clear: function () {
            this.model.destroy();
            this.remove();
        }
    });

    var Page = Backbone.View.extend({

        resizeTimer: null,
        files: null,
        el: $("#app"),
        tagName: 'div',
        template: _.template($('#page').html()),
        events: {
            'change input': 'update',
            'change select': 'update',
            'click #preview': 'preview',
            'click #reset': 'reset',
            'click #test': 'convert',
            'click #scan': 'scan'
        },

        mask: function (show) {
            var m = $('#mask');
            if (show) {
                m.fadeIn();
            } else {
                m.fadeOut();
            }
        },

        reset: function () {
            var d = this.model.defaults();
            this.model.set(d);
            this.model.save();
        },

        // For debug only - but useful for when things
        // have gone a bit wrong
        clearStorage: function () {
            var ls = this.model.localStorage;
            var all = ls.findAll();
            for (var i = 0; i < all.length; i++) {
                var m = all[i];
                ls.destroy(m);
            }
        },

        // When a UI field is updated, its change event
        // should be propagated here
        update: function (e) {
            var field = e.target;
            var o = {};

            switch (field.id) {
                case 'top':
                case 'left':
                case 'height':
                case 'width':
                case 'resolution':
                    o[field.id] = parseInt(field.value);
                    break;

                case 'brightness':
                case 'contrast':
                    var val = parseInt(field.value);
                    var $slider = $("#" + field.id + "_slider");
                    val = isNaN(val) ? $slider.slider("value") : val;
                    if (val < -100) val = -100;
                    if (val > 100) val = 100;
                    field.value = val;
                    o[field.id] = val;
                    $slider.slider("value", val);
                    break;

                default:
                    o[field.id] = field.value;
                    break;
            }

            this.model.set(o);
            this.model.save();
        },

        diagnostics: function () {
            var o = {
                url: 'diagnostics',
            };

            // Start the scan
            return $.ajax(o)
                .done(function (tests) {
                    _.each(tests, function (test) {
                        if (test.success == true) {
                            toastr.success(test.message);
                        } else {
                            toastr.error(test.message);
                        }
                    });
                });
        },

        // Called to take the preview image and return it as
        // a base64 encoded jpg and update the UI
        convert: function () {
            var o = {
                url: 'convert',
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(page.model.toJSON())
            };

            return $.ajax(o).then(function (fileInfo) {
                if (fileInfo.content) {
                    $("#image").attr('src',"data:image/jpeg;base64," + fileInfo.content);
                }
            });            
        },

        preview: function () {
            page.mask(true);

            // Keep reloading the preview image
            var timer = window.setInterval(this.convert, 500);

            var o = {
                url: 'preview',
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(this.model.toJSON())
            };

            // Start the scan
            return $.ajax(o)
                .fail(function (xhr) {
                    window.clearInterval(timer);
                    page.mask(false);
                    toastr.error(xhr.responseJSON.message);
                })
                .done(function () {
                    window.clearInterval(timer);
                    page.mask(false);
                });
        },

        scan: function () {
            page.mask(true);

            var o = {
                url: 'scan',
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(this.model.toJSON())
            };

            return $.ajax(o)
                .fail(function (xhr) {
                    page.mask(false);
                    toastr.error(xhr.responseJSON.message);
                })
                .then(function () {
                    page.mask(false);
                    page.files.fetch();
                });            
        },

        initialize: function () {

            this.files = new FileCollection();

            this.listenTo(this.files, 'add', this.add);

            var html = this.template();
            this.$el.append(html);

            $(window).on('resize', function () {
                clearTimeout(page.resizeTimer);
                this.resizeTimer = setTimeout(function () {
                    jcropmanager.init();
                    page.convert();
                }, 100);
            });

            $(".slider").slider({
                min: -100,
                max: 100,
                value: 0,
                step: 1,
                slide: function (e, ui) {
                    var $input = $("#" + e.target.id.replace("_slider", ""));
                    $input.val(ui.value).change();
                }
            });

            this.files.fetch();

            this.model = new ScanRequest();

            // Now listen to the model and call render
            this.model.on("change", this.render, this);

            // Get our data
            this.model.fetch();

            this.render();
        },

        render: function (ev) {
            var attrs = (ev && ev.changed) || this.model.attributes;
            _.each(attrs, function (val, id) {
                var $e = this.$('#' + id);
                if ($e) {
                    $e.val(val);
                }

                if (id === 'contrast' || id === 'brightness') {
                    $e = this.$('#' + id + '_slider');
                    $e.slider('value', val);
                }
            });
        },

        add: function (file) {
            var view = new FileView({ model: file });
            var render = view.render();
            this.$("#files-table-body").append(render.el);
        }
    });

    var jcropmanager = {

        model: null,

        millimetresPerInch: 25.4,
        a4: {
            width: 215,
            height: 297
        },

        jcrop_api: null,

        dotsToMm: function (dots) {
            var millimetresPerDot = this.millimetresPerInch / this.previewDpi;
            return Math.round(dots * millimetresPerDot);
        },

        mmToDots: function (mm) {
            var dotsPerMm = this.previewDpi / this.millimetresPerInch;
            return Math.round(mm * dotsPerMm);
        },

        //jcrop onChange and onSelect event handler
        showCoords: function (c) {
            jcropmanager.model.set({
                'left': jcropmanager.dotsToMm(c.x),
                'top': jcropmanager.dotsToMm(c.y),
                'width': jcropmanager.dotsToMm(c.w),
                'height': jcropmanager.dotsToMm(c.h)
            });
            jcropmanager.model.save();
        },

        //jcrop onRelease event handler
        clearCoords: function () {
            jcropmanager.model.set({
                'left': 0,
                'top': 0,
                'width': jcropmanager.canvas.width,
                'height': jcropmanager.canvas.height
            });
            jcropmanager.model.save();
        },

        getSelect: function () {
            var data = jcropmanager.model.toJSON();
            return [
                jcropmanager.mmToDots(data.left),
                jcropmanager.mmToDots(data.height + data.top),
                jcropmanager.mmToDots(data.width + data.left),
                jcropmanager.mmToDots(data.top)
            ];
        },

        init: function (model) {

            // Get page dimensions
            var width = $('#fields').width();
            var factor = jcropmanager.millimetresPerInch / jcropmanager.a4.width;

            $.extend(jcropmanager, {
                previewDpi: width * factor,
                canvas: {
                    width: width,
                    height: width * jcropmanager.a4.height / jcropmanager.a4.width
                },
                model: model
            });

            // Destroy any existing jcrop
            if (jcropmanager.jcrop_api) {
                jcropmanager.jcrop_api.destroy();
            }

            // Recreate the image container
            $('#previewPane').append('<div id="image"></div>');
            $('#image').css('width', jcropmanager.canvas.width);
            $('#image').css('height', jcropmanager.canvas.height);

            $('#image').Jcrop({
                onChange: jcropmanager.showCoords,
                onSelect: jcropmanager.showCoords,
                onRelease: jcropmanager.clearCoords,
                setSelect: jcropmanager.getSelect()
            }, function () {
                jcropmanager.jcrop_api = this;
            });
        }
    };

    var page = new Page();
    page.convert();
    jcropmanager.init(page.model);
    page.diagnostics();
});


