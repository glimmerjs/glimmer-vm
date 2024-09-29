import type { BeginDetails } from 'qunit';
import fuzzysort from 'fuzzysort';

import type { DropdownData, ExtendedQUnit, ModuleDetails } from './extended';

import { errorString, escapeText } from './utils.js';

const StringMap = Map;

const stats = {
  failedTests: [] as string[],
  defined: 0,
  completed: 0,
};

const PREFIX = 'qunit-custom-';

function getElement<E extends Element>(id: string): E {
  const element = document.getElementById(`${PREFIX}${id}`);

  return element as unknown as E;
}

/** @import {DropdownData, ExtendedQUnit, ModuleDetails, UrlConfig} from './qunit' */

/**
 * @param {ExtendedQUnit} QUnit
 * @returns
 */
export function start(QUnit: ExtendedQUnit) {
  QUnit.reporters.perf.init(QUnit);

  const config = QUnit.config;

  const hiddenTests: Element[] = [];
  let collapseNext = false;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const hasOwn = Object.prototype.hasOwnProperty;
  const unfilteredUrl = setUrl({
    filter: undefined,
    module: undefined,
    moduleId: undefined,
    testId: undefined,
  });

  let dropdownData: DropdownData | null = null;

  function getDropdownData(): DropdownData {
    if (!dropdownData) {
      throw new Error('Dropdown data not initialized');
    }
    return dropdownData;
  }

  function trim(string: string): string {
    if (typeof string.trim === 'function') {
      return string.trim();
    } else {
      return string.replace(/^\s+|\s+$/gu, '');
    }
  }

  function addEvent<E extends Event>(elem: Node, type: string, fn: (e: E) => void) {
    elem.addEventListener(type, fn as EventListener, false);
  }

  function removeEvent<E extends Event>(elem: Node, type: string, fn: (e: E) => void) {
    elem.removeEventListener(type, fn as EventListener, false);
  }

  function addEvents(elems: HTMLCollectionOf<HTMLElement>, type: string, fn: EventListener) {
    for (const elem of elems) {
      addEvent(elem, type, fn);
    }
  }

  function abortTests() {
    const abortButton = getElement<HTMLButtonElement>('abort-tests-button');
    if (abortButton) {
      abortButton.disabled = true;
      abortButton.innerHTML = 'Aborting...';
    }
    QUnit.config.queue.length = 0;
    return false;
  }

  function interceptNavigation(ev: Event) {
    // Trim potential accidental whitespace so that QUnit doesn't throw an error about no tests matching the filter.
    const filterInputElem = getElement<HTMLInputElement>('filter-input');
    filterInputElem.value = trim(filterInputElem.value);

    applyUrlParams();

    if (ev && ev.preventDefault) {
      ev.preventDefault();
    }

    return false;
  }

  function getUrlConfigHtml() {
    let selection = false;
    const urlConfig = config.urlConfig;
    let urlConfigHtml = '';

    for (let val of urlConfig) {
      // Options can be either strings or objects with nonempty "id" properties
      if (typeof val === 'string') {
        val = {
          id: val,
          label: val,
        };
      }

      let escaped = escapeText(val.id);
      let escapedTooltip = escapeText(val.tooltip);

      if (!val.value || typeof val.value === 'string') {
        urlConfigHtml +=
          `<label for='${PREFIX}urlconfig-` +
          escaped +
          "' title='" +
          escapedTooltip +
          `'><input id='${PREFIX}urlconfig-` +
          escaped +
          "' name='" +
          escaped +
          "' type='checkbox'" +
          (val.value ? " value='" + escapeText(val.value) + "'" : '') +
          (config[val.id!] ? " checked='checked'" : '') +
          " title='" +
          escapedTooltip +
          "' />" +
          escapeText(val.label) +
          '</label>';
      } else {
        urlConfigHtml +=
          `<label for='${PREFIX}urlconfig-` +
          escaped +
          "' title='" +
          escapedTooltip +
          "'>" +
          val.label +
          `: </label><select id='${PREFIX}urlconfig-` +
          escaped +
          "' name='" +
          escaped +
          "' title='" +
          escapedTooltip +
          "'><option></option>";

        if (Array.isArray(val.value)) {
          for (let j = 0; j < val.value.length; j++) {
            escaped = escapeText(val.value[j]);
            urlConfigHtml +=
              "<option value='" +
              escaped +
              "'" +
              (config[val.id!] === val.value[j]
                ? (selection = true) && " selected='selected'"
                : '') +
              '>' +
              escaped +
              '</option>';
          }
        } else {
          for (let j in val.value) {
            if (hasOwn.call(val.value, j)) {
              urlConfigHtml +=
                "<option value='" +
                escapeText(j) +
                "'" +
                (config[val.id!] === j ? (selection = true) && " selected='selected'" : '') +
                '>' +
                escapeText(val.value[j]) +
                '</option>';
            }
          }
        }
        if (config[val.id!] && !selection) {
          escaped = escapeText(config[val.id!]);
          urlConfigHtml +=
            "<option value='" +
            escaped +
            "' selected='selected' disabled='disabled'>" +
            escaped +
            '</option>';
        }
        urlConfigHtml += '</select>';
      }
    }

    return urlConfigHtml;
  }

  // Handle "click" events on toolbar checkboxes and "change" for select menus.
  // Updates the URL with the new state of `config.urlConfig` values.
  /**
   * @this {HTMLInputElement | HTMLSelectElement}
   */
  function toolbarChanged(this: HTMLInputElement | HTMLSelectElement) {
    /** @type {Record<string, string | boolean | undefined>} */
    const params: Record<string, string | boolean | undefined> = {};

    // Detect if field is a select menu or a checkbox
    let value;
    if ('selectedIndex' in this) {
      value = this.options[this.selectedIndex]?.value || undefined;
    } else {
      value = this.checked ? this.defaultValue || true : undefined;
    }

    params[this.name] = value;
    let updatedUrl = setUrl(params);

    // Check if we can apply the change without a page refresh
    if (this.name === 'hidepassed' && 'replaceState' in window.history) {
      QUnit.urlParams[this.name] = value;
      config[this.name] = value || false;
      let tests = getElement('tests');
      if (tests) {
        const children = tests.children;

        if ('checked' in this && this.checked) {
          for (const test of children) {
            const className = test ? test.className : '';
            const classNameHasPass = className.indexOf('pass') > -1;
            const classNameHasSkipped = className.indexOf('skipped') > -1;

            if (classNameHasPass || classNameHasSkipped) {
              hiddenTests.push(test);
            }
          }

          for (const hiddenTest of hiddenTests) {
            tests.removeChild(hiddenTest);
          }
        } else {
          let test;
          while ((test = hiddenTests.pop()) != null) {
            tests.appendChild(test);
          }
        }
      }
      window.history.replaceState(null, '', updatedUrl);
    } else {
      window.location.assign(updatedUrl);
    }
  }

  type ParamUpdate = string | number | boolean | undefined | string[];

  /**
   * @param {Record<string, unknown>} params
   * @returns {string}
   */
  function setUrl(params: Record<string, ParamUpdate>): URL {
    const url = new URL(window.location.href);
    const search = url.searchParams;

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === false) {
        search.delete(key);
      } else if (value === true) {
        search.set(key, '');
      } else if (Array.isArray(value)) {
        search.delete(key);
        for (const val of value) {
          search.append(key, val);
        }
      } else {
        search.set(key, String(value));
      }
    }

    return url;
  }

  function applyUrlParams() {
    const filter = getElement<HTMLInputElement>('filter-input').value;

    window.location.assign(
      setUrl({
        filter: filter === '' ? undefined : filter,
        moduleId: [...(dropdownData?.selectedMap.keys() ?? [])],

        // Remove module and testId filter
        module: undefined,
        testId: undefined,
      })
    );
  }

  function toolbarUrlConfigContainer() {
    const urlConfigContainer = document.createElement('span');

    urlConfigContainer.innerHTML = getUrlConfigHtml();
    urlConfigContainer.classList.add('qunit-url-config');

    addEvents(urlConfigContainer.getElementsByTagName('input'), 'change', toolbarChanged);
    addEvents(urlConfigContainer.getElementsByTagName('select'), 'change', toolbarChanged);

    return urlConfigContainer;
  }

  function abortTestsButton() {
    const button = document.createElement('button');
    button.id = `${PREFIX}abort-tests-button`;
    button.innerHTML = 'Abort';
    addEvent(button, 'click', abortTests);
    return button;
  }

  function toolbarLooseFilter() {
    const filter = document.createElement('form');
    const label = document.createElement('label');
    const input = document.createElement('input');
    const button = document.createElement('button');

    filter.classList.add('qunit-filter');

    label.innerHTML = 'Filter: ';

    input.type = 'text';
    input.value = config['filter'] || '';
    input.name = 'filter';
    input.id = `${PREFIX}filter-input`;

    button.innerHTML = 'Go';

    label.appendChild(input);

    filter.appendChild(label);
    filter.appendChild(document.createTextNode(' '));
    filter.appendChild(button);
    addEvent(filter, 'submit', interceptNavigation);

    return filter;
  }

  /**
   * @param {string | undefined} moduleId
   * @param {string | undefined} name
   * @param {boolean} checked
   */
  function createModuleListItem(
    moduleId: string | undefined,
    name: string | undefined,
    checked: boolean
  ) {
    return (
      '<li><label class="clickable' +
      (checked ? ' checked' : '') +
      '"><input type="checkbox" ' +
      'value="' +
      escapeText(moduleId) +
      '"' +
      (checked ? ' checked="checked"' : '') +
      ' />' +
      escapeText(name) +
      '</label></li>'
    );
  }

  function moduleListHtml(results: readonly { obj: ModuleDetails }[]): string {
    let html = '';

    // Hoist the already selected items, and show them always
    // even if not matched by the current search.
    dropdownData?.selectedMap.forEach((name, moduleId) => {
      html += createModuleListItem(moduleId, name, true);
    });

    for (const { obj: mod } of results) {
      if (!getDropdownData().selectedMap.has(mod.moduleId)) {
        html += createModuleListItem(mod.moduleId, mod.name, false);
      }
    }
    return html;
  }

  function toolbarModuleFilter(beginDetails: BeginDetails) {
    let initialSelected: Map<string, string> = new Map();
    dropdownData = {
      options: beginDetails.modules.slice(),
      selectedMap: new StringMap(),
      isDirty: function () {
        return (
          [...getDropdownData().selectedMap.keys()].sort().join(',') !==
          [...initialSelected.keys()].sort().join(',')
        );
      },
    };

    if (config.moduleId.length) {
      // The module dropdown is seeded with the runtime configuration of the last run.
      //
      // We don't reference `config.moduleId` directly after this and keep our own
      // copy because:
      // 1. This naturally filters out unknown moduleIds.
      // 2. Gives us a place to manage and remember unsubmitted checkbox changes.
      // 3. Gives us an efficient way to map a selected moduleId to module name
      //    during rendering.
      for (const mod of beginDetails.modules) {
        if (config.moduleId.indexOf(mod.moduleId) !== -1) {
          dropdownData.selectedMap.set(mod.moduleId, mod.name);
        }
      }
    }

    initialSelected = new Map(dropdownData.selectedMap);

    const moduleSearch = document.createElement('input');
    moduleSearch.id = `${PREFIX}modulefilter-search`;
    moduleSearch.autocomplete = 'off';
    addEvent(moduleSearch, 'input', searchInput);
    addEvent(moduleSearch, 'input', searchFocus);
    addEvent(moduleSearch, 'focus', searchFocus);
    addEvent(moduleSearch, 'click', searchFocus);

    const label = document.createElement('label');
    label.htmlFor = `${PREFIX}modulefilter-search`;
    label.textContent = 'Module:';
    const searchContainer = document.createElement('span');
    searchContainer.id = `${PREFIX}modulefilter-search-container`;
    searchContainer.appendChild(moduleSearch);

    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply';
    applyButton.title = 'Re-run the selected test modules';
    addEvent(applyButton, 'click', applyUrlParams);

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.type = 'reset';
    resetButton.title = 'Restore the previous module selection';

    const clearButton = document.createElement('button');
    clearButton.textContent = 'Select none';
    clearButton.type = 'button';
    clearButton.title = 'Clear the current module selection';
    addEvent(clearButton, 'click', () => {
      dropdownData?.selectedMap.clear();
      selectionChange();
      searchInput();
    });

    const actions = document.createElement('span');
    actions.id = `${PREFIX}modulefilter-actions`;
    actions.appendChild(applyButton);
    actions.appendChild(resetButton);
    if (initialSelected.size) {
      // Only show clear button if functionally different from reset
      actions.appendChild(clearButton);
    }

    const dropDownList = document.createElement('ul');
    dropDownList.id = `${PREFIX}modulefilter-dropdown-list`;

    const dropDown = document.createElement('div');
    dropDown.id = `${PREFIX}modulefilter-dropdown`;
    dropDown.style.display = 'none';
    dropDown.appendChild(actions);
    dropDown.appendChild(dropDownList);
    addEvent(dropDown, 'change', selectionChange);
    searchContainer.appendChild(dropDown);
    // Set initial moduleSearch.placeholder and clearButton/resetButton.
    selectionChange();

    const moduleFilter = document.createElement('form');
    moduleFilter.id = `${PREFIX}modulefilter`;
    moduleFilter.appendChild(label);
    moduleFilter.appendChild(document.createTextNode(' '));
    moduleFilter.appendChild(searchContainer);
    addEvent(moduleFilter, 'submit', interceptNavigation);
    addEvent(moduleFilter, 'reset', () => {
      getDropdownData().selectedMap = new StringMap(initialSelected);
      // Set moduleSearch.placeholder and reflect non-dirty state
      selectionChange();
      searchInput();
    });

    // Enables show/hide for the dropdown
    function searchFocus() {
      if (dropDown.style.display !== 'none') {
        return;
      }

      // Optimization: Defer rendering options until focussed.
      // https://github.com/qunitjs/qunit/issues/1664
      searchInput();
      dropDown.style.display = 'block';

      // Hide on Escape keydown or on click outside the container
      addEvent(document, 'click', hideHandler);
      addEvent(document, 'keydown', hideHandler);

      function hideHandler(e: KeyboardEvent | MouseEvent) {
        const inContainer = moduleFilter.contains(e.target as Node);
        const keycode = 'code' in e ? e.code : null;

        if (keycode === 'Escape' || !inContainer) {
          if (keycode === 'Escape' && inContainer) {
            moduleSearch.focus();
          }
          dropDown.style.display = 'none';
          removeEvent(document, 'click', hideHandler);
          removeEvent(document, 'keydown', hideHandler);
          moduleSearch.value = '';
          searchInput();
        }
      }
    }

    /**
     * @param {string} searchText
     * @return {string} HTML
     */
    function filterModules(searchText: string): string {
      let results: readonly { obj: ModuleDetails }[];
      let dropdown = getDropdownData();

      if (searchText === '') {
        results = dropdown.options.slice(0, 20).map((mod) => ({ obj: mod }));
      } else {
        results = fuzzysort.go(searchText, dropdown.options, {
          limit: 20,
          key: 'name',
        });
      }

      return moduleListHtml(results);
    }

    // Processes module search box input
    let searchInputTimeout: number;
    function searchInput() {
      // Use a debounce with a ~0ms timeout. This is effectively instantaneous,
      // but is better than undebounced because it avoids an ever-growing
      // backlog of unprocessed now-outdated input events if fuzzysearch or
      // drodown DOM is slow (e.g. very large test suite).
      window.clearTimeout(searchInputTimeout);
      searchInputTimeout = window.setTimeout(() => {
        dropDownList.innerHTML = filterModules(moduleSearch.value);
      });
    }

    // Processes checkbox change, or a generic render (initial render, or after reset event)
    // Avoid any dropdown rendering here as this is used by toolbarModuleFilter()
    // during the initial render, which should not delay test execution.
    function selectionChange(evt?: Event | undefined) {
      const checkbox = (evt && evt.target) || null;
      const dropdown = getDropdownData();

      if (checkbox && checkbox instanceof HTMLInputElement) {
        const parent = checkbox.parentNode;

        if (parent && parent instanceof HTMLElement) {
          // Update internal state
          if (checkbox.checked) {
            dropdown.selectedMap.set(checkbox.value, parent.textContent ?? '');
          } else {
            dropdown.selectedMap.delete(checkbox.value);
          }

          // Update UI state
          parent.classList.toggle('checked', checkbox.checked);
        }
      }

      const textForm = dropdown.selectedMap.size
        ? dropdown.selectedMap.size + ' ' + (dropdown.selectedMap.size === 1 ? 'module' : 'modules')
        : 'All modules';
      moduleSearch.placeholder = textForm;
      moduleSearch.title = 'Type to search through and reduce the list.';
      resetButton.disabled = !dropdown.isDirty();
      clearButton.style.display = dropdown.selectedMap.size ? '' : 'none';
    }

    return moduleFilter;
  }

  function appendToolbar(beginDetails: BeginDetails) {
    const toolbar = getElement(`testrunner-toolbar`);
    if (toolbar) {
      toolbar.appendChild(toolbarUrlConfigContainer());

      const toolbarFilters = document.createElement('span');
      toolbarFilters.id = `${PREFIX}toolbar-filters`;
      toolbarFilters.appendChild(toolbarLooseFilter());
      toolbarFilters.appendChild(toolbarModuleFilter(beginDetails));

      const clearfix = document.createElement('div');
      clearfix.className = 'clearfix';

      toolbar.appendChild(toolbarFilters);
      toolbar.appendChild(clearfix);
    }
  }

  function appendHeader() {
    const header = getElement('header');

    if (header) {
      header.innerHTML =
        "<a href='" + escapeText(unfilteredUrl.href) + "'>" + header.innerHTML + '</a> ';
    }
  }

  function appendBanner() {
    const banner = getElement('banner');

    if (banner) {
      banner.className = '';
    }
  }

  function appendTestResults() {
    const tests = getElement('tests');
    let result = getElement('testresult');
    let controls;

    if (result) {
      result.remove();
    }

    if (tests) {
      tests.innerHTML = '';
      result = document.createElement('p');
      result.id = `${PREFIX}testresult`;
      result.className = 'result';
      tests.before(result);
      result.innerHTML =
        `<div id="${PREFIX}testresult-display">Running...<br />&#160;</div>` +
        `<div id="${PREFIX}testresult-controls"></div>` +
        '<div class="clearfix"></div>';
      controls = getElement('testresult-controls');
    }

    if (controls) {
      controls.appendChild(abortTestsButton());
    }
  }

  function appendFilteredTest() {
    const testId = QUnit.config.testId;
    if (!testId || testId.length <= 0) {
      return '';
    }
    return (
      `<div id='${PREFIX}filteredTest'>Rerunning selected tests: ` +
      escapeText(testId.join(', ')) +
      ` <a id='${PREFIX}clearFilter' href='` +
      escapeText(unfilteredUrl.href) +
      "'>Run all tests</a></div>"
    );
  }

  function appendUserAgent() {
    const userAgent = getElement('userAgent');

    if (userAgent) {
      userAgent.innerHTML = '';
      userAgent.appendChild(
        document.createTextNode('QUnit ' + QUnit.version + '; ' + navigator.userAgent)
      );
    }
  }

  function appendInterface(beginDetails: BeginDetails) {
    const qunit = document.getElementById('qunit-custom');

    // For compat with QUnit 1.2, and to support fully custom theme HTML,
    // we will use any existing elements if no id="qunit" element exists.
    //
    // Note that we don't fail or fallback to creating it ourselves,
    // because not having id="qunit" (and not having the below elements)
    // simply means QUnit acts headless, allowing users to use their own
    // reporters, or for a test runner to listen for events directly without
    // having the HTML reporter actively render anything.
    if (qunit) {
      qunit.setAttribute('role', 'main');

      // Since QUnit 1.3, these are created automatically if the page
      // contains id="qunit".
      qunit.innerHTML =
        `<h1 id='${PREFIX}header'>` +
        escapeText(document.title) +
        '</h1>' +
        `<h2 id='${PREFIX}banner'></h2>` +
        `<div id='${PREFIX}testrunner-toolbar' role='navigation'></div>` +
        appendFilteredTest() +
        `<h2 id='${PREFIX}userAgent'></h2>` +
        `<ol id='${PREFIX}tests'></ol>`;
    }

    appendHeader();
    appendBanner();
    appendTestResults();
    appendUserAgent();
    appendToolbar(beginDetails);
  }

  function appendTest(name: string, testId?: string | undefined, moduleName?: string | undefined) {
    const tests = getElement('tests');
    if (!tests) {
      return;
    }

    let title = document.createElement('strong');
    title.innerHTML = getNameHtml(name, moduleName);

    let testBlock = document.createElement('li');
    testBlock.appendChild(title);

    // No ID or rerun link for "global failure" blocks
    if (testId !== undefined) {
      let rerunTrigger = document.createElement('a');
      rerunTrigger.innerHTML = 'Rerun';
      rerunTrigger.href = setUrl({ testId: testId }).href;

      testBlock.id = `${PREFIX}test-output-` + testId;
      testBlock.appendChild(rerunTrigger);
    }

    let assertList = document.createElement('ol');
    assertList.className = 'qunit-assert-list';

    testBlock.appendChild(assertList);

    tests.appendChild(testBlock);

    return testBlock;
  }

  // HTML Reporter initialization and load
  QUnit.on('runStart', (runStart) => {
    stats.defined = runStart.testCounts.total;
  });

  QUnit.begin((beginDetails) => {
    // Initialize QUnit elements
    // This is done from begin() instead of runStart, because
    // urlparams.js uses begin(), which we need to wait for.
    // urlparams.js in turn uses begin() to allow plugins to
    // add entries to QUnit.config.urlConfig, which may be done
    // asynchronously.
    // <https://github.com/qunitjs/qunit/issues/1657>
    appendInterface(beginDetails);
  });

  function getRerunFailedHtml(failedTests: string | string[]) {
    if (failedTests.length === 0) {
      return '';
    }

    const url = setUrl({ testId: failedTests });
    return [
      "<br /><a href='" + escapeText(url.href) + "'>",
      failedTests.length === 1
        ? 'Rerun 1 failed test'
        : 'Rerun ' + failedTests.length + ' failed tests',
      '</a>',
    ].join('');
  }

  QUnit.on('runEnd', (runEnd) => {
    const banner = getElement('banner');
    const tests = getElement('tests');
    const abortButton = getElement<HTMLButtonElement>('abort-tests-button');
    const assertPassed = config.stats.all - config.stats.bad;
    let html = [
      runEnd.testCounts.total,
      ' tests completed in ',
      runEnd.runtime,
      ' milliseconds, with ',
      runEnd.testCounts.failed,
      ' failed, ',
      runEnd.testCounts.skipped,
      ' skipped, and ',
      runEnd.testCounts.todo,
      ' todo.<br />',
      "<span class='passed'>",
      assertPassed,
      "</span> assertions of <span class='total'>",
      config.stats.all,
      "</span> passed, <span class='failed'>",
      config.stats.bad,
      '</span> failed.',
      getRerunFailedHtml(stats.failedTests),
    ].join('');
    let assertLi;
    let assertList;

    // Update remaining tests to aborted
    if (abortButton && abortButton.disabled) {
      html = 'Tests aborted after ' + runEnd.runtime + ' milliseconds.';

      for (const test of tests.children) {
        if (test.className === '' || test.className === 'running') {
          test.className = 'aborted';
          assertList = test.getElementsByTagName('ol')[0];
          assertLi = document.createElement('li');
          assertLi.className = 'fail';
          assertLi.innerHTML = 'Test aborted.';
          assertList?.appendChild(assertLi);
        }
      }
    }

    if (banner && (!abortButton || abortButton.disabled === false)) {
      banner.className = runEnd.status === 'failed' ? 'qunit-fail' : 'qunit-pass';
    }

    if (abortButton) {
      abortButton.remove();
    }

    if (tests) {
      getElement('testresult-display').innerHTML = html;
    }

    if (config.altertitle && document.title) {
      // Show ✖ for good, ✔ for bad suite result in title
      // use escape sequences in case file gets loaded with non-utf-8
      // charset
      document.title = [
        runEnd.status === 'failed' ? '\u2716' : '\u2714',
        document.title.replace(/^[\u{2714}\u{2716}] /u, ''),
      ].join(' ');
    }

    // Scroll back to top to show results
    if (config.scrolltop && window.scrollTo) {
      window.scrollTo(0, 0);
    }
  });

  function getNameHtml(name: string, module: string | undefined) {
    let nameHtml = '';

    if (module) {
      nameHtml = "<span class='module-name'>" + escapeText(module) + '</span>: ';
    }

    nameHtml += "<span class='test-name'>" + escapeText(name) + '</span>';

    return nameHtml;
  }

  function getProgressHtml(stats: { completed: number; defined: number }) {
    return [stats.completed, ' / ', stats.defined, ' tests completed.<br />'].join('');
  }

  QUnit.testStart((details) => {
    let running, bad;

    appendTest(details.name, details.testId, details.module);

    running = getElement('testresult-display');

    if (running) {
      running.classList.add('running');

      bad = QUnit.config.reorder && details.previousFailure;

      running.innerHTML = [
        getProgressHtml(stats),
        bad ? 'Rerunning previously failed test: <br />' : 'Running: ',
        getNameHtml(details.name, details.module),
        getRerunFailedHtml(stats.failedTests),
      ].join('');
    }
  });

  function stripHtml(string: string) {
    // Strip tags, html entity and whitespaces
    return string
      .replace(/<[^>]+(?:>|$)/gu, '')
      .replace(/&quot;/gu, '')
      .replace(/\s+/gu, '');
  }

  QUnit.log((details) => {
    const testItem = getElement('test-output-' + details.testId);
    if (!testItem) {
      return;
    }

    let message = escapeText(details.message) || (details.result ? 'okay' : 'failed');
    message = "<span class='test-message'>" + message + '</span>';
    message += "<span class='runtime'>@ " + details.runtime + ' ms</span>';

    let expected;
    let actual;
    let diff;
    let showDiff = false;

    // The pushFailure doesn't provide details.expected
    // when it calls, it's implicit to also not show expected and diff stuff
    // Also, we need to check details.expected existence, as it can exist and be undefined
    if (!details.result && hasOwn.call(details, 'expected')) {
      if (details.negative) {
        expected = 'NOT ' + QUnit.dump.parse(details.expected);
      } else {
        expected = QUnit.dump.parse(details.expected);
      }

      actual = QUnit.dump.parse(details.actual);
      message +=
        "<table><tr class='test-expected'><th>Expected: </th><td><pre>" +
        escapeText(expected) +
        '</pre></td></tr>';

      if (actual !== expected) {
        message +=
          "<tr class='test-actual'><th>Result!: </th><td><pre>" +
          escapeText(actual) +
          '</pre></td></tr>';

        if (typeof details.actual === 'number' && typeof details.expected === 'number') {
          if (!isNaN(details.actual) && !isNaN(details.expected)) {
            showDiff = true;
            diff = details.actual - details.expected;
            diff = (diff > 0 ? '+' : '') + diff;
          }
        } else if (typeof details.actual !== 'boolean' && typeof details.expected !== 'boolean') {
          diff = QUnit.diff(expected, actual);

          // don't show diff if there is zero overlap
          showDiff =
            stripHtml(diff).length !== stripHtml(expected).length + stripHtml(actual).length;
        }

        if (showDiff) {
          message += "<tr class='test-diff'><th>Diff!: </th><td><pre>" + diff + '</pre></td></tr>';
        }
      } else if (
        expected.indexOf('[object Array]') !== -1 ||
        expected.indexOf('[object Object]') !== -1
      ) {
        message +=
          "<tr class='test-message'><th>Message: </th><td>" +
          'Diff suppressed as the depth of object is more than current max depth (' +
          QUnit.config.maxDepth +
          ').<p>Hint: Use <code>QUnit.dump.maxDepth</code> to ' +
          " run with a higher max depth or <a href='" +
          escapeText(setUrl({ maxDepth: -1 }).href) +
          "'>" +
          'Rerun</a> without max depth.</p></td></tr>';
      } else {
        message +=
          "<tr class='test-message'><th>Message: </th><td>" +
          'Diff suppressed as the expected and actual results have an equivalent' +
          ' serialization</td></tr>';
      }

      if (details.source) {
        message +=
          "<tr class='test-source'><th>Source: </th><td><pre>" +
          escapeText(details.source) +
          '</pre></td></tr>';
      }

      message += '</table>';

      // This occurs when pushFailure is set and we have an extracted stack trace
    } else if (!details.result && details.source) {
      message +=
        '<table>' +
        "<tr class='test-source'><th>Source: </th><td><pre>" +
        escapeText(details.source) +
        '</pre></td></tr>' +
        '</table>';
    }

    let assertList = testItem.getElementsByTagName('ol')[0] as HTMLOListElement;

    let assertLi = document.createElement('li');
    assertLi.className = details.result ? 'pass' : 'fail';
    assertLi.innerHTML = message;
    assertList.appendChild(assertLi);
  });

  QUnit.testDone((details) => {
    const tests = getElement('tests');
    const testItem = getElement<HTMLLIElement>('test-output-' + details.testId);
    if (!tests || !testItem) {
      return;
    }

    testItem.classList.remove('running');

    let status;
    if (details.failed > 0) {
      status = 'failed';
    } else if (details.todo) {
      status = 'todo';
    } else {
      status = details.skipped ? 'skipped' : 'passed';
    }

    let assertList = testItem.getElementsByTagName('ol')[0] as HTMLOListElement;

    let good = details.passed;
    let bad = details.failed;

    // This test passed if it has no unexpected failed assertions
    const testPassed = details.failed > 0 ? details.todo : !details.todo;

    if (testPassed) {
      // Collapse the passing tests
      assertList.classList.add('qunit-collapsed');
    } else {
      stats.failedTests.push(details.testId);

      if (config.collapse) {
        if (!collapseNext) {
          // Skip collapsing the first failing test
          collapseNext = true;
        } else {
          // Collapse remaining tests
          assertList.classList.add('qunit-collapsed');
        }
      }
    }

    // The testItem.firstChild is the test name
    let testTitle = testItem.firstElementChild as HTMLElement;

    let testCounts = bad
      ? "<b class='failed'>" + bad + '</b>, ' + "<b class='passed'>" + good + '</b>, '
      : '';

    testTitle.innerHTML +=
      " <b class='counts'>(" + testCounts + details.assertions.length + ')</b>';

    stats.completed++;

    if (details.skipped) {
      testItem.className = 'skipped';
      let skipped = document.createElement('em');
      skipped.className = 'qunit-skipped-label';
      skipped.innerHTML = 'skipped';
      testItem.insertBefore(skipped, testTitle);
    } else {
      addEvent(testTitle, 'click', () => {
        assertList.classList.toggle('qunit-collapsed');
      });

      testItem.className = testPassed ? 'pass' : 'fail';

      if (details.todo) {
        const todoLabel = document.createElement('em');
        todoLabel.className = 'qunit-todo-label';
        todoLabel.innerHTML = 'todo';
        testItem.className += ' todo';
        testItem.insertBefore(todoLabel, testTitle);
      }

      let time = document.createElement('span');
      time.className = 'runtime';
      time.innerHTML = details.runtime + ' ms';
      testItem.insertBefore(time, assertList);
    }

    // Show the source of the test when showing assertions
    if (details.source) {
      let sourceName = document.createElement('p');
      sourceName.innerHTML = '<strong>Source: </strong>' + escapeText(details.source);
      sourceName.classList.add('qunit-source');
      if (testPassed) {
        sourceName.classList.add('qunit-collapsed');
      }
      addEvent(testTitle, 'click', () => {
        sourceName.classList.toggle('qunit-collapsed');
      });
      testItem.appendChild(sourceName);
    }

    if (config.hidepassed && (status === 'passed' || details.skipped)) {
      // use removeChild instead of remove because of support
      hiddenTests.push(testItem);

      tests.removeChild(testItem);
    }
  });

  QUnit.on('error', (error) => {
    const testItem = appendTest('global failure');
    if (!testItem) {
      // HTML Reporter is probably disabled or not yet initialized.
      return;
    }

    // Render similar to a failed assertion (see above QUnit.log callback)
    let message = escapeText(errorString(error));
    message = "<span class='test-message'>" + message + '</span>';
    if (error && error.stack) {
      message +=
        '<table>' +
        "<tr class='test-source'><th>Source: </th><td><pre>" +
        escapeText(error.stack) +
        '</pre></td></tr>' +
        '</table>';
    }
    const assertList = testItem.getElementsByTagName('ol')[0];
    const assertLi = document.createElement('li');
    assertLi.className = 'fail';
    assertLi.innerHTML = message;
    assertList?.appendChild(assertLi);

    // Make it visible
    testItem.className = 'fail';
  });

  // Wrap window.onerror. We will call the original window.onerror to see if
  // the existing handler fully handles the error; if not, we will call the
  // QUnit.onError function.
  const originalWindowOnError = window.onerror;

  // Cover uncaught exceptions
  // Returning true will suppress the default browser handler,
  // returning false will let it run.
  window.onerror = function (message, fileName, lineNumber, columnNumber, errorObj, ...args) {
    let ret = false;
    if (originalWindowOnError) {
      ret = originalWindowOnError.call(
        this,
        message,
        fileName,
        lineNumber,
        columnNumber,
        errorObj,
        ...args
      );
    }

    // Treat return value as window.onerror itself does,
    // Only do our handling if not suppressed.
    if (ret !== true) {
      // If there is a current test that sets the internal `ignoreGlobalErrors` field
      // (such as during `assert.throws()`), then the error is ignored and native
      // error reporting is suppressed as well. This is because in browsers, an error
      // can sometimes end up in `window.onerror` instead of in the local try/catch.
      // This ignoring of errors does not apply to our general onUncaughtException
      // method, nor to our `unhandledRejection` handlers, as those are not meant
      // to receive an "expected" error during `assert.throws()`.
      if (config.current && config.current.ignoreGlobalErrors) {
        return true;
      }

      // According to
      // https://blog.sentry.io/2016/01/04/client-javascript-reporting-window-onerror,
      // most modern browsers support an errorObj argument; use that to
      // get a full stack trace if it's available.
      const error = errorObj || new Error(message);
      if (!error.stack && fileName && lineNumber) {
        error.stack = `${fileName}:${lineNumber}`;
      }
      QUnit.onUncaughtException(error);
    }

    return ret;
  };

  window.addEventListener('unhandledrejection', (event) => {
    QUnit.onUncaughtException(event.reason);
  });
}
