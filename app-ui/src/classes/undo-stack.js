/**
 * Simple undo/redo stack using state snapshots (deep-cloned JSON arrays).
 */
export default class UndoStack {
  constructor() {
    this.history = [];
    this.pointer = -1;
  }

  /**
   * Push a new state snapshot, truncating any redo history.
   * @param {Array} state
   */
  push(state) {
    this.history = this.history.slice(0, this.pointer + 1);
    this.history.push(JSON.parse(JSON.stringify(state)));
    this.pointer++;
  }

  /**
   * @returns {Array|null} previous state, or null if at beginning
   */
  undo() {
    return this.pointer > 0
      ? JSON.parse(JSON.stringify(this.history[--this.pointer]))
      : null;
  }

  /**
   * @returns {Array|null} next state, or null if at end
   */
  redo() {
    return this.pointer < this.history.length - 1
      ? JSON.parse(JSON.stringify(this.history[++this.pointer]))
      : null;
  }

  get canUndo() {
    return this.pointer > 0;
  }

  get canRedo() {
    return this.pointer < this.history.length - 1;
  }

  clear() {
    this.history = [];
    this.pointer = -1;
  }
}
