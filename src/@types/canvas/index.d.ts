declare module 'canvas' {
    namespace Canvas {
        class Image {
            src: Buffer | string

            width: number
            height: number
        }
    }
    class Canvas {
        constructor(width: number, height: number)

        getContext(type: '2d'): CanvasRenderingContext2D
        toBuffer(): Buffer
    }
    export = Canvas
}
