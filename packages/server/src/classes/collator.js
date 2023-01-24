module.exports = new class Collator {
  /**
   * @param {FileInfo[]} files
   * @param {boolean} standard
   * @returns {FileInfo[]}
   */
  collate(files, standard) {
    const odd = files.filter(f => f.name.match(/-1-\d{4}\.tif/));
    const even = files.filter(f => f.name.match(/-2-\d{4}\.tif/));

    // This is counter-intuitive and probably badly named. But by default the
    // even pages are coming in in reverse order - so that is standard. If the
    // scanner has output the scans in the reverse order then we don't need to
    // reverse the even pages
    if (standard) {
      even.sort((f1, f2) => -f1.name.localeCompare(f2.name));
    }

    files = [];
    for (let index = 0; index < odd.length; index++) {
      files.push(odd[index]);
      if (even[index]) {
        files.push(even[index]);
      }
    }
    return files;
  }
};
