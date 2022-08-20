const puppeteer = require("puppeteer");
require('dotenv').config();
const fs = require('fs');
const gTTS = require("gtts");
var ffmpeg = require("fluent-ffmpeg");
const getMP3Duration = require('get-mp3-duration')

const PlaylistLink = process.env.PLAYLIST_LINK;
const Email = process.env.EMAIL;
const Password = process.env.PASSWORD;
const NovelTitle = process.env.NOVEL_TITLE;
const NovelLinkPrefix = process.env.NOVEL_LINK_PREFIX;
const NovelLinkSuffix = process.env.NOVEL_LINK_SUFFIX;
const TextPathSelector = process.env.TEXT_PATH_SELECTOR;
const TitlePathSelector = process.env.TITLE_PATH_SELECTOR;
const FfmpegPath = process.env.FFMPEG_PATH;
const ImagePath = process.env.IMAGE_PATH;

console.log("PlaylistLink:", PlaylistLink);
console.log("Email:", Email);
console.log("Password:", Password);
console.log("NovelTitle:", NovelTitle);
console.log("NovelLinkPrefix:", NovelLinkPrefix);
console.log("NovelLinkSuffix:", NovelLinkSuffix);
console.log("TextPathSelector:", TextPathSelector);
console.log("TitlePathSelector:", TitlePathSelector);
console.log("FfmpegPath:", FfmpegPath);
console.log("ImagePath:", ImagePath);
console.log("\n");

async function GetAllUploadedChapters() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(PlaylistLink);

    await page.evaluate(
        () =>
            new Promise((resolve) => {
                var scrollTop = -1;
                var ticks = 0;
                const interval = setInterval(() => {
                    window.scrollBy(0, 100000);
                    if (document.documentElement.scrollTop !== scrollTop) {
                        scrollTop = document.documentElement.scrollTop;
                        ticks = 0;
                        return;
                    } else {
                        ticks++;
                    }
                    if (ticks > 100) {  // 100 ticks = 10 second
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            })
    );

    const videos = await page.evaluate(() => {
        return Array.from(
            document.querySelectorAll("#video-title"),
            (video) => video.innerText
        );
    });

    await browser.close();
    return videos;
}

async function GetChapter(uploadTile, chapterLink) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(chapterLink);

    let texts = await page.evaluate((TextPathSelector) => {
        return Array.from(document.querySelectorAll(TextPathSelector))
            .filter(p => !p.querySelector("a")) // blacklist items, currently pure p allowed
            .filter(p => !p.querySelector("abbr"))
            .filter(p => !p.querySelector("area"))
            .filter(p => !p.querySelector("audio"))
            .filter(p => !p.querySelector("b"))
            .filter(p => !p.querySelector("bdi"))
            .filter(p => !p.querySelector("bdo"))
            .filter(p => !p.querySelector("br"))
            .filter(p => !p.querySelector("button"))
            .filter(p => !p.querySelector("canvas"))
            .filter(p => !p.querySelector("cite"))
            .filter(p => !p.querySelector("code"))
            .filter(p => !p.querySelector("command"))
            .filter(p => !p.querySelector("datalist"))
            .filter(p => !p.querySelector("del"))
            .filter(p => !p.querySelector("dfn"))
            .filter(p => !p.querySelector("em"))
            .filter(p => !p.querySelector("embed"))
            .filter(p => !p.querySelector("i"))
            .filter(p => !p.querySelector("iframe"))
            .filter(p => !p.querySelector("img"))
            .filter(p => !p.querySelector("input"))
            .filter(p => !p.querySelector("ins"))
            .filter(p => !p.querySelector("kbd"))
            .filter(p => !p.querySelector("keygen"))
            .filter(p => !p.querySelector("label"))
            .filter(p => !p.querySelector("map"))
            .filter(p => !p.querySelector("mark"))
            .filter(p => !p.querySelector("math"))
            .filter(p => !p.querySelector("meter"))
            .filter(p => !p.querySelector("noscript"))
            .filter(p => !p.querySelector("object"))
            .filter(p => !p.querySelector("output"))
            .filter(p => !p.querySelector("progress"))
            .filter(p => !p.querySelector("q"))
            .filter(p => !p.querySelector("ruby"))
            .filter(p => !p.querySelector("s"))
            .filter(p => !p.querySelector("samp"))
            .filter(p => !p.querySelector("script"))
            .filter(p => !p.querySelector("select"))
            .filter(p => !p.querySelector("small"))
            .filter(p => !p.querySelector("span"))
            .filter(p => !p.querySelector("strong"))
            .filter(p => !p.querySelector("sub"))
            .filter(p => !p.querySelector("sup"))
            .filter(p => !p.querySelector("svg"))
            .filter(p => !p.querySelector("textarea"))
            .filter(p => !p.querySelector("time"))
            .filter(p => !p.querySelector("u"))
            .filter(p => !p.querySelector("var"))
            .filter(p => !p.querySelector("video"))
            .filter(p => !p.querySelector("wbr"))
            .filter(p => !p.querySelector("text"))
            .map(p => p.innerText);
    }, TextPathSelector);

    if (texts.length === 0) {
        console.log("No text found in chapter:", chapterLink);
        await browser.close();
        return;
    }

    let chapterTitle = await page.evaluate((TitlePathSelector) => {
        return document.querySelector(TitlePathSelector).innerText.split(':')[0].trim();
    }, TitlePathSelector);

    await browser.close();
    
    console.log(`${uploadTile} text recieved!`);
    let mp3Path = `./${uploadTile}.mp3`;
    (async () => {
        await new gTTS(`${chapterTitle} ${texts.join(" ")}`).save(mp3Path, (err) => {
        if (err) { throw err; }
        console.log(`${uploadTile}.mp3 saved!`);
        let duration = getMP3Duration(fs.readFileSync(mp3Path)) * 0.001;
        new ffmpeg(mp3Path)
            .setFfmpegPath(FfmpegPath)
            .input(ImagePath)
            .inputFPS(1 / duration)
            .loop(duration)
            .save(`./${uploadTile}.mp4`)
            .on("end", function () {
                fs.unlink(mp3Path, (err) => {
                    if (err) { throw err; }
                    console.log(`${uploadTile}.mp3 deleted!`);
                    console.log(`${uploadTile}.mp4 saved!`);
                });
            }).on("error", function (err) { throw err; });
        });
    })();
}

async function UploadChapters() {
    // const browser = await puppeteer.launch({ headless: false });
    // const page = await browser.newPage();
    // await page.goto(
    //     "https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%253A%252F%252Fwww.youtube.com%252F&hl=en&ec=65620"
    // );
    // await page.waitForSelector('input[type="email"]');
    // await page.type('input[type="email"]', Email);
    // await Promise.all([
    //     page.waitForNavigation(),
    //     await page.keyboard.press("Enter"),
    // ]);
    // await page.waitForSelector('input[type="password"]', { visible: true });
    // await page.type('input[type="password"]', Password);
    // const res = await Promise.all([
    //     page.waitForFunction(() => location.href === "https://www.youtube.com/"),
    //     await page.keyboard.press("Enter"),
    // ]);

    console.log("Checking all uploaded chapters, please wait...");
    let allUploadedChapters = await GetAllUploadedChapters();
    for (let i = 0; i < allUploadedChapters.length; i++) {
        console.log(allUploadedChapters[i]);
    }
    console.log("\n");;

    console.log("Searching for the first chapter to upload, please wait...");
    let chapter = 0;
    while (true) {
        chapter++;
        let uploadTile = `${NovelTitle} chapter ${chapter}`;
        if (allUploadedChapters.indexOf(uploadTile) === -1) {
            let chapterLink = NovelLinkPrefix + chapter + NovelLinkSuffix;
            console.log("Searching:", chapterLink);
            await GetChapter(uploadTile, chapterLink);
        } else {
            console.log("Chapter already uploaded:", uploadTile);
        }
    }
    // await browser.close();
}

UploadChapters();