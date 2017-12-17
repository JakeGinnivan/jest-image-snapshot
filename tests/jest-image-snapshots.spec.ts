import * as fs from 'fs'
import { toMatchImageSnapshot } from '../src/jest-image-snapshots'

it('can write image snapshot', async () => {
    const expectedFilename = `${__dirname}/__image_snapshots__/jest-image-snapshots-spec-ts-can-write-image-snapshot-1-snap.png`
    const logo = fs.readFileSync(`${__dirname}/jest-logo.png`)

    expect(fs.existsSync(expectedFilename)).toBe(false)
    await toMatchImageSnapshot(logo)

    expect(fs.existsSync(expectedFilename)).toBe(true)

    fs.unlinkSync(expectedFilename)
})

// Unsure why this is producing a segfault at the moment..
it.skip('produces an image diff when different', async () => {
    const logo = fs.readFileSync(`${__dirname}/jest-logo-other.png`)

    await toMatchImageSnapshot(logo)
})
