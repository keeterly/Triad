'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => showHowTo(() => {}));
  await t.sleep(400);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'howto-updated.png') });
  const n = await t.J(() => document.querySelectorAll('.howto .ov-line').length);
  console.log('how-to lines:', n);
  await t.browser.close(); process.exit(0);
})();
