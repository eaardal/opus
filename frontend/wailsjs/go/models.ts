export namespace main {
	
	export class OpenFileResult {
	    content: string;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenFileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.filePath = source["filePath"];
	    }
	}

}

