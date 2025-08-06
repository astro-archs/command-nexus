class Shader {
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private shader: WebGLProgram | null;
    
    // Optional: Store attribute and uniform locations
    public sbCoordsAttribute?: number;
    public sbMVMatrixUniform?: WebGLUniformLocation | null;
    public sbPMatrixUniform?: WebGLUniformLocation | null;
    public cubeTextureUniform?: WebGLUniformLocation | null;

    constructor(
        gl: WebGLRenderingContext | WebGL2RenderingContext, 
        vertexName: string, 
        fragmentName: string
    ) {
        this.gl = gl;
        this.shader = null;
        this.init(vertexName, fragmentName);
    }

    private getShader(id: string): WebGLShader | null {
        const script = document.getElementById(id) as HTMLScriptElement | null;
        if (!script) {
            console.error(`Shader script element with id '${id}' not found`);
            return null;
        }

        let str = "";
        let k = script.firstChild;
        while (k) {
            if (k.nodeType === Node.TEXT_NODE) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        let shader: WebGLShader | null = null;
        if (script.type === "x-shader/x-fragment") {
            shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        } else if (script.type === "x-shader/x-vertex") {
            shader = this.gl.createShader(this.gl.VERTEX_SHADER);
        } else {
            console.error(`Unknown shader type: ${script.type}`);
            return null;
        }

        if (!shader) {
            console.error("Failed to create shader");
            return null;
        }

        this.gl.shaderSource(shader, str);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            console.error(`Shader compilation error in '${id}':\n${error}`);
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    private init(vertexName: string, fragmentName: string): void {
        const vertexShader = this.getShader(vertexName);
        const fragmentShader = this.getShader(fragmentName);

        if (!vertexShader || !fragmentShader) {
            throw new Error("Failed to load shaders");
        }

        this.shader = this.gl.createProgram();
        if (!this.shader) {
            throw new Error("Failed to create shader program");
        }

        this.gl.attachShader(this.shader, vertexShader);
        this.gl.attachShader(this.shader, fragmentShader);
        this.gl.linkProgram(this.shader);

        if (!this.gl.getProgramParameter(this.shader, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(this.shader);
            console.error(`Shader program linking error:\n${error}`);
            this.gl.deleteProgram(this.shader);
            this.shader = null;
            throw new Error("Failed to link shader program");
        }

        // Clean up shaders after linking
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
    }

    public use(): void {
        if (this.shader) {
            this.gl.useProgram(this.shader);
        } else {
            console.warn("Attempting to use null shader program");
        }
    }

    public get(): WebGLProgram {
        if (!this.shader) {
            throw new Error("Shader program is not initialized");
        }
        return this.shader;
    }

    // Additional utility methods for better TypeScript usage

    public getAttribLocation(name: string): number {
        if (!this.shader) {
            throw new Error("Shader program is not initialized");
        }
        return this.gl.getAttribLocation(this.shader, name);
    }

    public getUniformLocation(name: string): WebGLUniformLocation | null {
        if (!this.shader) {
            throw new Error("Shader program is not initialized");
        }
        return this.gl.getUniformLocation(this.shader, name);
    }

    public setUniform1i(name: string, value: number): void {
        const location = this.getUniformLocation(name);
        if (location) {
            this.gl.uniform1i(location, value);
        }
    }

    public setUniform1f(name: string, value: number): void {
        const location = this.getUniformLocation(name);
        if (location) {
            this.gl.uniform1f(location, value);
        }
    }

    public setUniform3f(name: string, x: number, y: number, z: number): void {
        const location = this.getUniformLocation(name);
        if (location) {
            this.gl.uniform3f(location, x, y, z);
        }
    }

    public setUniformMatrix4fv(name: string, value: Float32Array | number[]): void {
        const location = this.getUniformLocation(name);
        if (location) {
            this.gl.uniformMatrix4fv(location, false, value);
        }
    }

    public dispose(): void {
        if (this.shader) {
            this.gl.deleteProgram(this.shader);
            this.shader = null;
        }
    }
}

export default Shader;

// Alternative: Modern approach using shader source strings instead of script tags
export class ShaderFromSource {
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private shader: WebGLProgram | null;

    constructor(
        gl: WebGLRenderingContext | WebGL2RenderingContext,
        vertexSource: string,
        fragmentSource: string
    ) {
        this.gl = gl;
        this.shader = null;
        this.initFromSource(vertexSource, fragmentSource);
    }

    private compileShader(source: string, type: number): WebGLShader {
        const shader = this.gl.createShader(type);
        if (!shader) {
            throw new Error("Failed to create shader");
        }

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compilation error:\n${error}`);
        }

        return shader;
    }

    private initFromSource(vertexSource: string, fragmentSource: string): void {
        const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

        this.shader = this.gl.createProgram();
        if (!this.shader) {
            throw new Error("Failed to create shader program");
        }

        this.gl.attachShader(this.shader, vertexShader);
        this.gl.attachShader(this.shader, fragmentShader);
        this.gl.linkProgram(this.shader);

        if (!this.gl.getProgramParameter(this.shader, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(this.shader);
            this.gl.deleteProgram(this.shader);
            this.shader = null;
            throw new Error(`Shader program linking error:\n${error}`);
        }

        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
    }

    public use(): void {
        if (this.shader) {
            this.gl.useProgram(this.shader);
        }
    }

    public get(): WebGLProgram {
        if (!this.shader) {
            throw new Error("Shader program is not initialized");
        }
        return this.shader;
    }

    public dispose(): void {
        if (this.shader) {
            this.gl.deleteProgram(this.shader);
            this.shader = null;
        }
    }
}