const puppeteer = require('puppeteer');
const fs = require('fs');
const config = require('./config.json');
const cookies = require('./cookies.json');
var data = require('./data/data.json');

try {
  var remember_position = require('./data/logs.json'); // try get logs
} catch (err) {
  console.log(err);
}

if (typeof remember_position !== 'undefined') {
	console.log('Remember position at: ', remember_position["index"])
	data = data.slice(remember_position["index"]); // update data if logs exists
}

(async () => {
  /* Start up puppeteer and create a new page */
  let browser = await puppeteer.launch({ headless: false });
  let page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768});

  /* check if we have a previously saved session */
  if(Object.keys(cookies).length) {
    console.log('has cookie')

    /* Set the saved cookies in the puppeteer browser page */
    await page.setCookie(...cookies);

    /* Go to kiotviet */
    await page.goto('https://0938298220.kiotviet.vn/#/Products', { waitUntil: 'networkidle2' });

    // close popup
    await page.waitForSelector('.fa-times');
    await page.click('.fa-times');

    (async function() {
      for ( var i = 0; i < data.length; i++){
        /* filling form */
        // search product by code
        await page.waitForSelector('[ng-model="filterQuickSearch"]');
        await page.type('[ng-model="filterQuickSearch"]', '', { delay: 30 });
        await page.type('[ng-model="filterQuickSearch"]', data[i].masp, { delay: 30 });
        await page.keyboard.press('Enter'); // Enter Key
        await page.waitFor(2000);

        // update product
        await page.waitForSelector('div.kv-group-btn > [ng-click="UpdateProduct(dataItem)"]');
        await page.click('div.kv-group-btn > [ng-click="UpdateProduct(dataItem)"]');
        await page.waitFor(500);

        // uploading image
        let text = data[i].masp;
        let codeValue = '';
        try {
          await page.waitFor('[ng-model="product.Code"]');
          codeValue = await page.$eval('[ng-model="product.Code"]', el => el.value);
          console.log(`The codeValue ===> "${codeValue}" was found on the page`);
          console.log(`The current Product CODE: "${text}"`);
        } catch(e) {
          console.log(`The codeValue "${codeValue}" was not found on the page`);
          console.log(`The current Product CODE: "${text}"`);
        }

        // stop if cannot found product CODE
        if (codeValue !== text) {
          console.log(`The codeValue "${codeValue}" and Product's code "${text}" are not equal. Stop program!!!`);
          console.log('');
          process.exit();
        } else {
          console.log(`The codeValue "${codeValue}" and Product's code "${text}" are equal. Start upload....`);

          await page.waitForSelector('#files');
          let multiple_files = []
          for ( var index = 0; index < data[i].tonganh; index++){
            if (index == 0) {
              multiple_files.push(( './images/' + data[i].masp + '.jpg'));

              console.log(`Processing "${data[i].masp}".jpg`);
            } else {
              // upload more
              if (index < data[i].tonganh) {
                multiple_files.push(( './images/' + data[i].masp + '_' + index + '.jpg'));
                console.log(`Processing "${data[i].masp}_${index}".jpg`)
              }
            }

            if (index == data[i].tonganh - 1) {
              console.log(`Bulk upload...`);
              let uploadMultiple = await page.$("#files");
              await uploadMultiple.uploadFile(...(multiple_files.reverse()));

              /* remember position */
              let logs_index = i+1;
              if (typeof remember_position !== 'undefined') {
                remember_position["index"] = remember_position["index"] +1;
                logs_index = remember_position["index"];
              }

              console.log('logs_index = ', logs_index);
              let logs = JSON.stringify({"index": logs_index});
              fs.writeFileSync("data/logs.json", logs);
              /* ===> end remember postion */
            }
          }

          // save product
          await page.waitForSelector('div.kv-window-footer > [ng-enter="SaveProduct()"]');
          await page.click('div.kv-window-footer > [ng-enter="SaveProduct()"]');
          await page.waitFor(500);

          console.log(`Update product "${codeValue}" successfully.`)
          console.log('');
        }
      }
    })();

  } else {
    console.log('no cookie');

    /* Go to the https://0938298220.kiotviet.vn/login?redirect=%2f#f=Unauthorized */
    await page.goto('https://0938298220.kiotviet.vn/login?redirect=%2f#f=Unauthorized', { waitUntil: 'networkidle0' });

    /* Write in the username and password */
    await page.waitForSelector('#UserName');
    await page.type('#UserName', config.username, { delay: 30 });
    await page.waitForSelector('#Password');
    await page.type('#Password', config.password, { delay: 30 });

    /* click the login button */
    await page.click('[name="quan-ly"]');

    /* Wait for navigation to finish */
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    // await page.waitFor(15000);

    /* Check if logged in */
    try {
      await page.waitFor('.userName');
    } catch(error) {
      console.log('Failed to login.');
      process.exit(0);
    }

    /* Get the current browser page session */
    let currentCookies = await page.cookies();
    console.log(currentCookies);

    /* Create a cookie file if not already created to hold the session */
    fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies));

  }
})();
