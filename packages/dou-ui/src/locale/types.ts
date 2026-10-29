/**
 * Every string DouUI renders on its own: labels read by screen readers
 * and the default messages of form rules.
 *
 * Messages may contain `{name}` placeholders, filled in when the string
 * is used.
 */
export interface Locale {
  /** A BCP 47 language tag, e.g. `zh-CN`. */
  name: string
  tabs: {
    /** Hint on the close button of a tab. */
    close: string
    /** The button that adds a tab. */
    add: string
  }
  input: {
    /** Label of the clear button. */
    clear: string
    /** The button that reveals a password. */
    showPassword: string
    hidePassword: string
  }
  tag: {
    /** Label of the remove button. */
    remove: string
  }
  inputNumber: {
    /** Label of the button that steps the value up. */
    increase: string
    /** Label of the button that steps the value down. */
    decrease: string
  }
  slider: {
    /** Label of the lower thumb of a range. */
    start: string
    /** Label of the upper thumb of a range. */
    end: string
  }
  alert: {
    /** Label of the close button. */
    close: string
  }
  dialog: {
    /** Label of the close button. */
    close: string
    /** Confirm button of `dialog.alert()`, `confirm()` and `prompt()`. */
    confirm: string
    /** Cancel button of `dialog.confirm()` and `prompt()`. */
    cancel: string
  }
  drawer: {
    /** Label of the close button. */
    close: string
  }
  select: {
    /** Shown in an empty select without a `placeholder`. */
    placeholder: string
    /** Shown when no option matches the search. */
    empty: string
    /** Label of the clear button. */
    clear: string
    /** Shown in the list while options load. */
    loading: string
    /** The option that creates a new value, with `{query}`. */
    create: string
  }
  spinner: {
    /** Read by screen readers while a spinner shows. */
    loading: string
  }
  toast: {
    /** Names the region that holds the toasts. */
    region: string
    /** Label of the close button. */
    close: string
  }
  empty: {
    /** Headline of an empty state without a title or description of its own. */
    title: string
  }
  breadcrumb: {
    /** Names the navigation landmark. */
    label: string
    /** Label of the ellipsis that expands a collapsed path. */
    expand: string
  }
  pagination: {
    /** Names the navigation landmark. */
    label: string
    /** Label of the previous page button. */
    prev: string
    /** Label of the next page button. */
    next: string
    /** Label of a page button, with `{page}`. */
    page: string
    /** The number of items, with `{total}`. */
    total: string
    /** An option of the page size select, with `{size}`. */
    pageSize: string
    /** Label of the page size select. */
    pageSizeLabel: string
  }
  table: {
    /** Label of the checkbox that selects every row. */
    selectAll: string
    /** Label of the checkbox that selects one row. */
    selectRow: string
    /** Names the column of detail-row toggles. */
    expand: string
    /** Label of the toggle that opens a row's details or children. */
    expandRow: string
    /** Label of a column's resize handle, with `{column}`. */
    resize: string
    /** Label of a column's filter button; `{column}` is its title. */
    filter: string
    filterReset: string
    filterConfirm: string
    /** The choice that clears a single-choice filter. */
    filterAll: string
  }
  upload: {
    /** The button that opens the file picker. */
    choose: string
    /** The dropzone's prompt, followed by `browse`. */
    drop: string
    /** The part of the dropzone's prompt that reads as a link. */
    browse: string
    /** Names the list of files. */
    list: string
    /** Label of the remove button, followed by the file name. */
    remove: string
    /** Label of the retry button, followed by the file name. */
    retry: string
    /** The button that opens the preview of an image card. */
    preview: string
    /** Shown while a file is sent, followed by the percentage. */
    uploading: string
    /** Shown when a file failed to send. */
    error: string
  }
  datePicker: {
    /** Shown in an empty date field. */
    placeholder: string
    /** Shown in an empty month field. */
    monthPlaceholder: string
    datetimePlaceholder: string
    weekPlaceholder: string
    /** Names the time columns of a `datetime`. */
    time: string
    /** The button that picks this moment. */
    now: string
    /** The button that commits a `datetime`. */
    confirm: string
    /** Shown in an empty year field. */
    yearPlaceholder: string
    /** The start field of a range. */
    start: string
    /** The end field of a range. */
    end: string
    /** The button that picks today. */
    today: string
    /** Label of the clear button. */
    clear: string
    prevMonth: string
    nextMonth: string
    prevYear: string
    nextYear: string
    prevDecade: string
    nextDecade: string
  }
  command: {
    /** Shown in the empty search box, and names it. */
    placeholder: string
    /** Shown when nothing matches. */
    empty: string
  }
  steps: {
    /** Read after the title of a step that is done. */
    finish: string
    /** Read after the title of the current step. */
    process: string
    /** Read after the title of a step not reached yet. */
    wait: string
    /** Read after the title of a step that failed. */
    error: string
  }
  flowGraph: {
    /** Names the graph when nothing else labels it. */
    label: string
    status: {
      wait: string
      process: string
      finish: string
      error: string
      /** In progress while something it depends on is not finished. */
      blocked: string
    }
    kind: {
      task: string
      milestone: string
    }
    /** A node with unfinished sub-tasks. */
    incomplete: string
    /** The legend entry for the progress bar. */
    progress: string
    /** Read for a node's progress, with `{value}`. */
    progressValue: string
    /** Read for what a node depends on, with `{list}`. */
    dependsOn: string
    /** Joins the parts of a node's screen reader label, and the names in `{list}`. */
    separator: string
    /** Title of the legend, also the label of its button. */
    legend: string
    zoomIn: string
    zoomOut: string
    /** The button that shows the whole graph. */
    fit: string
    /** The current zoom, with `{value}` in percent. */
    zoomLevel: string
  }
  rate: {
    /** Read as the value of the stars, with `{value}` and `{max}`. */
    value: string
  }
  autocomplete: {
    /** Shown while suggestions are fetched. */
    loading: string
  }
  timePicker: {
    placeholder: string
    /** The start field of a range. */
    start: string
    /** The end field of a range. */
    end: string
    /** Names the hour column. */
    hour: string
    minute: string
    second: string
    /** The button that picks the current time. */
    now: string
    /** The button that closes the panel. */
    confirm: string
    /** Label of the clear button. */
    clear: string
  }
  cascader: {
    placeholder: string
    /** Shown when nothing matches, or a level is empty. */
    empty: string
    clear: string
  }
  colorPicker: {
    /** Shown in an empty field, and names the panel. */
    placeholder: string
    /** Names the saturation and brightness square. */
    area: string
    /** Reads its value, with `{s}` and `{v}` in percent. */
    areaValue: string
    /** Names the hue and saturation wheel. */
    wheel: string
    /** Reads its value, with `{h}` in degrees and `{s}` in percent. */
    wheelValue: string
    /** Label the square and the wheel in the panel switcher. */
    panelSquare: string
    panelWheel: string
    /** Names the panel switcher. */
    panels: string
    /** Names the text box with the color value. */
    text: string
    /** Names the format menu next to the text box. */
    format: string
    presets: string
    clear: string
    /* channels, naming the sliders */
    hue: string
    alpha: string
    red: string
    green: string
    blue: string
    saturation: string
    /** HSL and Lab lightness. */
    lightness: string
    /** HSV value. */
    brightness: string
    whiteness: string
    blackness: string
    chroma: string
    /** The green–red axis of Lab and Oklab. */
    axisA: string
    /** The blue–yellow axis of Lab and Oklab. */
    axisB: string
  }
  transfer: {
    /** The heading of the left list. */
    source: string
    /** The heading of the right list. */
    target: string
    search: string
    /** An empty list. */
    empty: string
    /** A search that found nothing. */
    noMatch: string
    /** Label of the select-all box. */
    selectAll: string
    /** Checked of total, with `{checked}` and `{total}`. */
    count: string
    toTarget: string
    toSource: string
  }
  popconfirm: {
    confirm: string
    cancel: string
  }
  statistic: {
    /** Read for the arrow of a number that went up. */
    up: string
    down: string
  }
  image: {
    /** Names the preview, and a previewable image without `alt`. */
    preview: string
    /** A picture that could not be loaded. */
    error: string
    prev: string
    next: string
    close: string
    zoomIn: string
    zoomOut: string
    rotateLeft: string
    rotateRight: string
    reset: string
    /** Which picture of how many, with `{index}` and `{total}`. */
    counter: string
  }
  pageHeader: {
    /** The back button before the title. */
    back: string
  }
  backTop: {
    label: string
  }
  splitter: {
    /** Names the divider. */
    label: string
  }
  anchor: {
    /** Names the navigation. */
    label: string
  }
  copyButton: {
    copy: string
    /** Said once the text is on the clipboard. */
    copied: string
  }
  layout: {
    /** Label of the button that collapses an aside. */
    collapse: string
    /** Label of the button that expands a collapsed aside. */
    expand: string
    /** Label of the button that opens an aside shown as a drawer on narrow screens. */
    open: string
  }
  colorMode: {
    /** Names the color mode select. */
    label: string
    light: string
    dark: string
    /** Follow the system's preference. */
    system: string
    /** Label of the color mode button while the page is light. */
    toDark: string
    /** Label of the color mode button while the page is dark. */
    toLight: string
  }
  listbox: {
    /** Placeholder of the search box. */
    search: string
    /** Shown when no option matches. */
    empty: string
  }
  inputOtp: {
    /** Names the code field when nothing else labels it. */
    label: string
  }
  qrcode: {
    /** Names the code for screen readers, with `{value}`. */
    label: string
    /** Shown over an expired code. */
    expired: string
    /** The button that asks for a new code. */
    refresh: string
    /** Read while a code loads. */
    loading: string
  }
  calendarView: {
    /** Events that did not fit in a day, with `{count}`. */
    more: string
    /** A day's label when it has events, with `{date}` and `{count}`. */
    dayWithEvents: string
  }
  infiniteScroll: {
    /** Shown at the end of the list while the next page loads. */
    loading: string
    /** Shown at the end once there is nothing more to load. */
    finished: string
    /** Shown at the end after a load failed. */
    error: string
    /** The button that tries the failed load again. */
    retry: string
  }
  banner: {
    /** Names a banner that has no title. */
    label: string
    close: string
  }
  ellipsis: {
    expand: string
    collapse: string
  }
  sortable: {
    /** What a draggable item is, read as its role. */
    item: string
    /** Names an item by its position, with `{n}`. */
    position: string
    /** How to move an item with the keyboard. */
    hint: string
    /** Names a drag handle. */
    handle: string
    /* read while moving an item, with `{label}`, `{position}` and `{total}` */
    lifted: string
    moved: string
    dropped: string
    /** The move was undone, with `{label}`. */
    canceled: string
  }
  imageCropper: {
    /** Names the cropping area. */
    label: string
    /** How to move and zoom the image with the keyboard. */
    hint: string
    zoom: string
    zoomIn: string
    zoomOut: string
    rotateLeft: string
    rotateRight: string
    reset: string
    /** The image failed to load. */
    error: string
  }
  form: {
    /** Shown after the label of an optional field when `requiredMark` is `'optional'`. */
    optional: string
    /** A required field is empty. */
    required: string
    /** A text is shorter than `{min}` characters. */
    minLength: string
    /** A text is longer than `{max}` characters. */
    maxLength: string
    /** Fewer than `{min}` items are chosen. */
    minItems: string
    /** More than `{max}` items are chosen. */
    maxItems: string
    /** A number is below `{min}`. */
    min: string
    /** A number is above `{max}`. */
    max: string
    /** The value does not match `pattern`. */
    pattern: string
    email: string
    url: string
    /** A custom validator failed without a message of its own. */
    invalid: string
  }
}
