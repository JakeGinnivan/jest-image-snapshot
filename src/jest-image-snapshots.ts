import * as fs from 'fs'
import * as path from 'path'
import * as dashify from 'dashify'
import { diffImageToSnapshot } from './diff-snapshot'
import {
    // EXPECTED_COLOR,
    // ensureNoExpected,
    // matcherHint,
    RECEIVED_COLOR
} from 'jest-matcher-utils'

export interface SnapshotState {
    _counters: Map<string, number>
    _dirty: boolean
    _index: number
    _updateSnapshot: jest.SnapshotUpdateState
    _snapshotData: { [key: string]: string }
    _snapshotPath: string
    _uncheckedKeys: Set<string>
    added: number
    expand: boolean
    matched: number
    unmatched: number
    updated: number

    markSnapshotsAsCheckedForTest(testName: string): void
    _addSnapshot(key: string, receivedSerialized: string): void
    save(): {
        deleted: false
        saved: false
    }
    getUncheckedCount(): number
    removeUncheckedKeys(): void
    match(
        testName: string,
        received: any,
        key?: string
    ): {
        actual: string
        count: number
        expected: string
        pass: boolean
    }
}

export interface MatcherState {
    assertionCalls: number
    currentTestName?: string
    equals: (a: any, b: any) => boolean
    expand?: boolean
    expectedAssertionsNumber: number | undefined
    isExpectingAssertions: boolean | undefined
    isNot: boolean
    snapshotState: SnapshotState
    suppressedErrors: Error[]
    testPath?: string
    utils: jest.MatcherUtils
}

export async function toMatchImageSnapshot(
    received: any,
    { customSnapshotIdentifier = '', misMatchPercentage = 0 } = {},
    identifierAssigned?: (
        identifier: string,
        snapshotPath: string
    ) => Promise<void>
) {
    const {
        testPath = '',
        currentTestName = '',
        isNot,
        snapshotState
    } = (expect as any).getState() as MatcherState
    if (isNot) {
        throw new Error(
            'Jest: `.not` cannot be used with `.toMatchImageSnapshot()`.'
        )
    }

    const testCounter = (snapshotState._counters.get(currentTestName) || 0) + 1
    snapshotState._counters.set(currentTestName, testCounter)

    const snapshotIdentifier =
        customSnapshotIdentifier ||
        dashify(
            `${path.basename(testPath)}-${currentTestName}-${testCounter}`
        ).replace('_', '-')
    const snapshotsDir = path.join(
        path.dirname(testPath),
        '__image_snapshots__'
    )

    if (identifierAssigned) {
        await identifierAssigned(snapshotIdentifier, snapshotsDir)
    }

    const result = await diffImageToSnapshot({
        imageData: received,
        snapshotIdentifier,
        snapshotsDir,
        updateSnapshot: snapshotState._updateSnapshot === 'all'
    })

    let pass = true
    if (result.updated) {
        snapshotState.updated += 1
    } else if (result.added) {
        snapshotState.added += 1
    } else if (!result.result) {
        pass = false
    } else if (result.result.details.misMatchPercentage > misMatchPercentage) {
        pass = false
        const outputPath = result.result.details.diffOutputPath
        const image = result.result.image

        await new Promise<void>((resolve, reject) => {
            fs.writeFile(outputPath, image, err => {
                if (err) {
                    return reject(err)
                }

                return resolve()
            })
        })
    }

    if (!pass) {
        const error =
            'Expected image to match or be a close match to snapshot.\n' +
            `${RECEIVED_COLOR('See diff for details:')} ${RECEIVED_COLOR(
                result.result && result.result.details.diffOutputPath
            )}`
        console.error(error)
        throw new Error(error)
    }
}
