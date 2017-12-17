import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import * as path from 'path'
import * as resemble from 'resemblejs'
import * as Canvas from 'canvas'

export type Options = {
    imageData: Buffer
    snapshotIdentifier: string
    snapshotsDir: string
    updateSnapshot: boolean
}

export interface DiffDetails {
    /**
     * Do the two images have the same dimensions?
     */
    isSameDimensions: boolean

    /**
     * The difference in width and height between the dimensions of the two compared images
     */
    dimensionDifference: {
        width: number
        height: number
    }

    /**
     * The percentage of pixels which do not match between the images
     */
    misMatchPercentage: number

    diffBounds: {
        top: number
        left: number
        bottom: number
        right: number
    }

    analysisTime: number

    diffOutputPath: string
    baselineSnapshotPath: string
}
export interface Diff {
    details: DiffDetails
    image: Buffer
}
export interface DiffResult {
    result?: Diff
    added: boolean
    updated: boolean
}

resemble.outputSettings({
    errorColor: {
        red: 255,
        green: 0,
        blue: 255
    },
    errorType: 'movement',
    transparency: 0.5,
    largeImageThreshold: 1200
})
export async function diffImageToSnapshot(
    options: Options
): Promise<DiffResult> {
    const {
        imageData,
        snapshotIdentifier,
        snapshotsDir,
        updateSnapshot = false
    } = options

    const baselineSnapshotPath = path.join(
        snapshotsDir,
        `${snapshotIdentifier}-snap.png`
    )
    if (fs.existsSync(baselineSnapshotPath) && !updateSnapshot) {
        const outputDir = path.join(snapshotsDir, '__diff_output__')
        const diffOutputPath = path.join(
            outputDir,
            `${snapshotIdentifier}-diff.png`
        )
        mkdirp.sync(outputDir)

        const diffDetails = await new Promise<Diff>(resolve => {
            type Result = resemble.ResembleComparisonResult & {
                getBuffer(): Buffer
            }
            // TODO These type definitions are for the browser only
            let comparison = resemble(baselineSnapshotPath).compareTo(
                imageData as any
            )

            if (process.env.EXACT_VR) {
                comparison = comparison.ignoreNothing()
            }
            comparison.onComplete(diffResult => {
                const diffBuffer = (diffResult as Result).getBuffer()

                // tslint:disable-next-line:no-console
                console.log('Diffing complete', diffResult)

                resolve({
                    details: {
                        analysisTime: diffResult.analysisTime,
                        diffBounds: diffResult.diffBounds,
                        dimensionDifference: diffResult.dimensionDifference,
                        isSameDimensions: diffResult.isSameDimensions,
                        misMatchPercentage: diffResult.misMatchPercentage,
                        diffOutputPath,
                        baselineSnapshotPath
                    },
                    image: diffBuffer
                })
            })
        })

        // The below creates a stiched image which is the baseline, the new,
        // then the diff in a single image
        const baselineBuffer = await new Promise<Buffer>((resolve, reject) => {
            fs.readFile(baselineSnapshotPath, (err, data) => {
                if (err) {
                    return reject(err)
                }

                resolve(data)
            })
        })

        const baselineImage = new Canvas.Image()
        baselineImage.src = baselineBuffer

        const diffImage = new Canvas.Image()
        diffImage.src = diffDetails.image

        const newImage = new Canvas.Image()
        newImage.src = imageData

        const maxWidth = Math.max(
            baselineImage.width,
            diffImage.width,
            newImage.width
        )

        // When width is larger than height, we should stack the images vertically
        if (
            maxWidth > baselineImage.height &&
            maxWidth > diffImage.height &&
            maxWidth > newImage.height
        ) {
            const stitchedImage = new Canvas(
                Math.max(baselineImage.width, diffImage.width, newImage.width),
                baselineImage.height + diffImage.height + newImage.height
            )
            const ctx = stitchedImage.getContext('2d')
            ctx.drawImage(baselineImage as any, 0, 0)
            ctx.drawImage(newImage as any, 0, baselineImage.height)
            ctx.drawImage(
                diffImage as any,
                0,
                baselineImage.height + newImage.height
            )
            diffDetails.image = stitchedImage.toBuffer()
        } else {
            // Otherwise horizontally
            const stitchedImage = new Canvas(
                baselineImage.width + diffImage.width + newImage.width,
                Math.max(
                    baselineImage.height,
                    diffImage.height,
                    newImage.height
                )
            )
            const ctx = stitchedImage.getContext('2d')
            ctx.drawImage(baselineImage as any, 0, 0)
            ctx.drawImage(newImage as any, baselineImage.width, 0)
            ctx.drawImage(
                diffImage as any,
                baselineImage.width + newImage.width,
                0
            )
            diffDetails.image = stitchedImage.toBuffer()
        }

        return {
            added: false,
            updated: false,
            result: diffDetails
        }
    }

    mkdirp.sync(snapshotsDir)
    fs.writeFileSync(baselineSnapshotPath, imageData)

    return updateSnapshot
        ? { updated: true, added: false }
        : { added: true, updated: false }
}
