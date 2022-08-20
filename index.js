const puppeteer = require("puppeteer");
require('dotenv').config();
const fs = require('fs');
var path = require('path');
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
const PlaylistDropdownPath = process.env.PLAYLIST_DROPDOWN_PATH;

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
console.log("PlaylistDropdownPath:", PlaylistDropdownPath);
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
                    if (ticks > 50) {  // 50 ticks = 5 second
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

async function uploadToYouTube(mp4Path, uploadPage, uploadTitle) {
    console.log(`Uploading ${uploadTitle} to YouTube`);
    await uploadPage.goto("https://www.youtube.com/upload");
    const elementHandle = await uploadPage.$('input[type="file"]');
    await elementHandle.uploadFile(mp4Path);
    await uploadPage.waitForSelector( // playlist dropdown button
        "#basics > div:nth-child(7) > div.compact-row.style-scope.ytcp-video-metadata-editor-basics > div:nth-child(1) > ytcp-video-metadata-playlists > ytcp-text-dropdown-trigger > ytcp-dropdown-trigger"
    );
    await uploadPage.click(
        "#basics > div:nth-child(7) > div.compact-row.style-scope.ytcp-video-metadata-editor-basics > div:nth-child(1) > ytcp-video-metadata-playlists > ytcp-text-dropdown-trigger > ytcp-dropdown-trigger"
    );

    // selecting the set playlist
    await uploadPage.waitForSelector(PlaylistDropdownPath);
    await uploadPage.click(PlaylistDropdownPath);

    await uploadPage.waitForSelector( // close the dropdown
        "#dialog > div.action-buttons.style-scope.ytcp-playlist-dialog > ytcp-button.done-button.action-button.style-scope.ytcp-playlist-dialog"
    );
    await uploadPage.click(
        "#dialog > div.action-buttons.style-scope.ytcp-playlist-dialog > ytcp-button.done-button.action-button.style-scope.ytcp-playlist-dialog"
    );

    // go to privacy settings
    await uploadPage.waitForSelector("#step-badge-3");
    await uploadPage.click("#step-badge-3");

    // select "public"
    await uploadPage.waitForSelector('tp-yt-paper-radio-button[name="PUBLIC"]');
    await uploadPage.click('tp-yt-paper-radio-button[name="PUBLIC"]');

    // select done
    await uploadPage.waitForSelector("#done-button");
    await uploadPage.click("#done-button");

    // wait for either of the dialogs to appear uploading
    await uploadPage.waitForSelector(
        "#html-body > ytcp-uploads-still-processing-dialog, #html-body > ytcp-video-share-dialog"
    );

    console.log(`Uploaded ${uploadTitle} to YouTube!`);
    fs.unlinkSync(mp4Path, (err) => {
        if (err) throw err;
        console.log(`${uploadTitle}.mp4 deleted!`);
    });
}

async function GetChapter(uploadPage, allUploadedChapters, chapterNumber) {
    console.log("Searching for chapter:", chapterNumber);
    let uploadTitle = `${NovelTitle} chapter ${chapterNumber}`;
    if (allUploadedChapters.indexOf(uploadTitle) === -1) {
        let chapterLink = NovelLinkPrefix + chapterNumber + NovelLinkSuffix;
        console.log("Searching:", chapterLink);

        const browser = await puppeteer.launch({ headless: true });
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

        console.log(`${uploadTitle} text received!`);
        console.log(`Creating mp3 for ${uploadTitle}...`);
        let mp3Path = `./mp3/${uploadTitle}.mp3`;
        await new gTTS(`${chapterTitle} ${texts.join(" ")}`).save(mp3Path, (err) => {
            if (err) { throw err; }
            console.log(`${uploadTitle}.mp3 saved!`);
            console.log(`Creating mp4 for ${uploadTitle}...`);
            let duration = getMP3Duration(fs.readFileSync(mp3Path)) * 0.001;
            let mp4Path = `./mp4/${uploadTitle}.mp4`;
            new ffmpeg(mp3Path)
                .setFfmpegPath(FfmpegPath)
                .input(ImagePath)
                .inputFPS(1 / duration)
                .loop(duration)
                .save(mp4Path)
                .on("end", function () {
                    console.log(`${uploadTitle}.mp4 saved!`);
                    fs.unlink(mp3Path, (err) => {
                        if (err) { throw err; }
                        console.log(`${uploadTitle}.mp3 deleted!`);
                        uploadToYouTube(mp4Path, uploadPage, uploadTitle);
                        GetChapter(uploadPage, allUploadedChapters, chapterNumber + 1);
                    });
                }).on("error", function (err) { throw err; });
        });
    } else {
        console.log("Chapter already uploaded:", uploadTitle);
        console.log("\n");
        await GetChapter(uploadPage, allUploadedChapters, chapterNumber + 1);
    }
}

async function UploadChapters() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(
        "https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%253A%252F%252Fwww.youtube.com%252F&hl=en&ec=65620"
    );
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', Email);
    await Promise.all([
        page.waitForNavigation(),
        await page.keyboard.press("Enter"),
    ]);
    await page.waitForSelector('input[type="password"]', { visible: true });
    await page.type('input[type="password"]', Password);
    const res = await Promise.all([
        page.waitForFunction(() => location.href === "https://www.youtube.com/"),
        await page.keyboard.press("Enter"),
    ]);

    fs.readdir("./mp3", (err, files) => {
        if (err) { throw err; }
        files.forEach(file => {
            fs.unlink(path.join("./mp3", file), err => {
                if (err) { throw err; }
            });
        });
    });
    fs.readdir("./mp4", (err, files) => {
        if (err) { throw err; }
        files.forEach(file => {
            fs.unlink(path.join("./mp4", file), err => {
                if (err) { throw err; }
            });
        });
    });

    console.log("Checking all uploaded chapters, please wait...");
    let allUploadedChapters = await GetAllUploadedChapters();
    for (let i = 0; i < allUploadedChapters.length; i++) {
        console.log(allUploadedChapters[i]);
    }
    console.log("Done\n");

    await GetChapter(page, allUploadedChapters, 1);

    // await browser.close();
}

UploadChapters();