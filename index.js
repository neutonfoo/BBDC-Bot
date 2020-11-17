require("dotenv").config();

const puppeteer = require("puppeteer-extra");
const userAgent = require("user-agents");
const prompts = require("prompts");
const moment = require("moment-timezone");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Default 1 minute
moment.tz.setDefault("Asia/Singapore");
// const currentMonthYear = moment().format("MMM/YYYY");
const currentMonthYear = "Dec/2020";
const bookingSessions = [1, 2, 3, 4, 5, 6, 7];
const refreshRate = 30000;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent.toString());
  await page.setDefaultNavigationTimeout(60000);

  await login(page);

  // # In Member Portal

  const leftFrameElement = await page.$("frame[name=leftFrame]");
  const mainFrameElement = await page.$("frame[name=mainFrame]");

  const bookingLinkSelector =
    "body > table > tbody > tr > td > table > tbody > tr:nth-child(15) > td:nth-child(3) > a";
  const iAgreeButtonSelector =
    "body > table > tbody > tr:nth-child(4) > td:nth-child(1) > input";

  const leftFrame = await leftFrameElement.contentFrame();
  const mainFrame = await mainFrameElement.contentFrame();

  // # Click Booking without Fixed Instructor
  await leftFrame.waitForSelector(bookingLinkSelector);
  await leftFrame.click(bookingLinkSelector);

  // Click "I Agree"
  await mainFrame.waitForSelector(iAgreeButtonSelector);
  await mainFrame.click(iAgreeButtonSelector);

  // # On Booking Search Page
  const searchButtonSelector = "input[name=btnSearch]";
  const backButtonSelector = 'input[value="<< Back"]';

  await mainFrame.waitForSelector(searchButtonSelector);
  await mainFrame.click(`input[name=Month][value="${currentMonthYear}"]`);
  // await mainFrame.click(`#checkMonth`);

  for (const bookingSession of bookingSessions) {
    await mainFrame.click(`input[name=Session][value="${bookingSession}"]`);
  }

  await mainFrame.click("input[name=allDay]");

  // # Click confirm() box. Has to be before event that triggers it
  page.on("dialog", async dialog => {
    await dialog.accept();
  });

  // Run loop
  const slotsSelector = "input[name=slot]";
  const submitButtonSelector = "input[name=btnSubmit]";
  const confirmButtonSelector = 'input[value="Confirm"]';

  while (true) {
    console.log(`${moment().format()} - Checking`);
    try {
      // const currentDayMonthYear = moment().format("DD/MM/YYYY");

      await mainFrame.click(searchButtonSelector);
      await mainFrame.waitForSelector(backButtonSelector);

      // # In booking listing page
      const slots = await mainFrame.$$(slotsSelector);

      if (slots.length > 0) {
        console.log("Booking found --- ");
        // There are open slots
        // Just book the first one
        const slot = slots[0];
        // Element Parent
        // const slotRow = (await slot.$x(".."))[0];

        await slot.click();
        await mainFrame.click(submitButtonSelector);
        await mainFrame.waitForSelector(confirmButtonSelector);
        await mainFrame.click(confirmButtonSelector);
        await mainFrame.waitForSelector("input[value='New Booking']");

        process.exit(1);
      } else {
        // Click Back
        await mainFrame.click(backButtonSelector);
        // Wait for Search button then wait for interval
        await mainFrame.waitForSelector(searchButtonSelector);
      }
    } catch (err) {
      console.log(`${moment().format()} - Error ${err}`);
    }

    await sleep(refreshRate);
  }
})();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page) {
  // # Login into BBDC
  await page.goto("https://info.bbdc.sg/members-login/");
  await page.type("#txtNRIC", process.env.BBDC_USERNAME);
  await page.type("#txtPassword", process.env.BBDC_PASSWORD);

  const response = await prompts({
    type: "confirm",
    name: "value",
    message: "Please complete reCaptcha",
    initial: true,
  });

  await page.click("input.btn-login");
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  await page.click("#proceed-button");
}
