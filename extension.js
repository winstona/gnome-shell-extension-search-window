/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
//
// Title: windowsearch@line72.net
// Version: 0.0.1
// File: extension.js
// Description: Gnome shell extension to search through active windows.
//  Search is done by application name and window title and integrates
//  nicely into the search display
// Todo: Add live previews of windows and optimize
//
// Copyright (C) 2011 - Marcus Dillavou <line72@line72.net>
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301  USA.

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Main = imports.ui.main;
const Search = imports.ui.search;
const IconGrid = imports.ui.iconGrid;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const SearchDisplay = imports.ui.searchDisplay;
/*function WindowSearchProvider() {
    this._init();
}
*/

let searchProvider = null;
let injections = {};

const WindowSearchIconBin = new Lang.Class({
    Name: 'WindowSearchIconBin',

    _init: function(result) {
        this.actor = new St.Bin({ reactive: true,
                                  track_hover: true });
        this.icon = new IconGrid.BaseIcon(result.name,
                                          { showLabel: true,
                                            createIcon: Lang.bind(this, result.createIcon) } );

        this.actor.child = this.icon.actor;
        this.actor.label_actor = this.icon.label;
    },

    //not used
    /*
    createIcon: function (size) {
        let box = new Clutter.Box();
        let icon = new St.Icon({ icon_name: 'windowsearch',
                                 icon_size: size });
        box.add_child(icon);
        let size = 22;
        let emblem = new St.Icon({ icon_name: 'gnome-terminal',
                                   icon_size: size});
        box.add_child(emblem);
        return box;
    }
    */
});


const WindowSearchProvider = new Lang.Class({
    //__proto__: Search.SearchProvider.prototype,
    Name: 'WindowSearchProvider',
    appInfo: Gio.DesktopAppInfo.new('gnome-terminal.desktop'),
    disableProviderIcon: 1,

    _init: function() {
        //Search.SearchProvider.prototype._init.call(this, _("WINDOWS"));
        log("init windowsearchprovider");
        this.title = "WINDOWS";
        this.id = "WINDOWS";

    },

    createResultActor: function (result, terms) {
        let icon = new WindowSearchIconBin(result);
        return icon.actor;
    },

    getResultMetas: function(ids, callback) {
        let metas = [];
        for (let i = 0; i < ids.length; i++) {
            metas.push(this.getResultMeta(ids[i]));
        }
        callback(metas);

    },

    getResultMeta: function(resultId) {
        let apps = this.getRunningApps();

        //log("getresultmeta: " + JSON.stringify(resultId, null, 4));
        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];
            let windows = app.get_windows();

            for (let j = 0; j < windows.length; j++) {
                let window = windows[j];

                let title = app.get_name() + ' - ' + window.get_title();
                

                if (resultId.title == title) {
                    return { 'id': resultId.title,
                             'name': window.get_title(),
                             'title': window.get_title(),
                             'extract':"None",
                             'show_icon':resultId.show_icon,
                             'createIcon': function(size) {
                                 return app.create_icon_texture(size);
                             }
                           };
                }
            }
        }

        log("should never get here");
        // !mwd - should never get here!
        return { 'id': resultId,
                 'name': resultId
               };

    },

    activateResult: function(id, params) {
        let apps = this.getRunningApps();

        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];
            let windows = app.get_windows();

            for (let j = 0; j < windows.length; j++) {
                let window = windows[j];

                let title = app.get_name() + ' - ' + window.get_title();
                
                if (id == title) {
                    // !mwd - we do this manually instead of calling
                    //  Main.activateWindow(window) because activateWindow
                    //  toggles the overview when it shouldn't and causes
                    //  weird focus and keyboard issues
                    //Main.activateWindow(window);

                    let activeWorkspaceNum = global.screen.get_active_workspace_index();
                    let windowWorkspaceNum = window.get_workspace().index();

                    time = global.get_current_time();

                    if (windowWorkspaceNum != activeWorkspaceNum) {
                        let workspace = global.screen.get_workspace_by_index(windowWorkspaceNum);
                        workspace.activate_with_focus(window, time);
                    } else {
                        window.activate(time);
                    }
                }
            }
        }
    },

    _getResultSet: function(sessions, terms) {
        let results = [];

        let apps = this.getRunningApps();

        terms = terms.map(String.toLowerCase);

        if (!apps.length)
            return results;

        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];

            let windows = app.get_windows();

            for (let j = 0; j < windows.length; j++) {
                let window = windows[j];
                let mtype = 0;

                let title = app.get_name() + ' - ' + window.get_title();
                let titleLower = String.toLowerCase(title);

                for (let k = 0; k < terms.length; k++) {
                    let idx = titleLower.indexOf(terms[k]);
                    if (idx == 0) {
                        mtype = 1;
                    } else if (idx > 0) {
                        if (mtype == 0)
                            mtype = 2;
                    } else {
                        mtype = 0;
                        break;
                    }
                }
                if (mtype != 0) {
                    results.push({
                        "title": title,
                        "show_icon": true});
                }
            }

        }
        //log("returning " + results.length + " results");
        this.searchSystem.pushResults(this, results);
        return results;
    },

    getInitialResultSet: function(terms) {
        return this._getResultSet([], terms);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        //!mwd - not too effecient here!
        return this._getResultSet([], terms);
    },

    getRunningApps: function() {
        return Shell.AppSystem.get_default().get_running();
    },


});







function init(extensionMeta) {
}

function enable() {
    if (!searchProvider) {
        injections['_init'] = SearchDisplay.ListSearchResults.prototype._init;
        injections['getResultsForDisplay'] = SearchDisplay.ListSearchResults.prototype.getResultsForDisplay;
        
        const MAX_LIST_SEARCH_RESULTS_ROWS = 50;
        SearchDisplay.ListSearchResults.prototype._init = function(provider) {
            this.provider = provider;

            this.actor = new St.BoxLayout({ style_class: 'search-section-content' });
            this.providerIcon = new SearchDisplay.ProviderIcon(provider);
            this.providerIcon.connect('clicked', Lang.bind(this,
                function() {
                    provider.launchSearch(this._terms);
                    Main.overview.toggle();
                }));

            if (!provider.disableProviderIcon) {
                this.actor.add(this.providerIcon, { x_fill: false,
                                                    y_fill: false,
                                                    x_align: St.Align.START,
                                                    y_align: St.Align.START });
            }

            this._content = new St.BoxLayout({ style_class: 'list-search-results',
                                               vertical: true });
            this.actor.add(this._content, { expand: true });

            this._notDisplayedResult = [];
            this._terms = [];
            this._pendingClear = false;
        };

        //Signals.addSignalMethods(SearchDisplay.ListSearchResults.prototype);

        searchProvider = new WindowSearchProvider();
        Main.overview.addSearchProvider(searchProvider);

        SearchDisplay.ListSearchResults.prototype.getResultsForDisplay =  function() {
            let alreadyVisible = this._pendingClear ? 0 : this.getVisibleResultCount();
            let canDisplay = MAX_LIST_SEARCH_RESULTS_ROWS - alreadyVisible;

            let newResults = this._notDisplayedResult.splice(0, canDisplay);
            return newResults;
        };
    }
}

function disable() {
    if (searchProvider) {
        log("removing search provder");
        Main.overview.removeSearchProvider(searchProvider);
        searchProvider = null;

        for (prop in injections) {
            log("removing " + prop + " override");
            SearchDisplay.ListSearchResults.prototype[prop] = injections[prop];
        }
    }
}


