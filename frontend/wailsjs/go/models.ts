export namespace main {
	
	export class AtlassianAuthStatus {
	    loggedIn: boolean;
	    displayName: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new AtlassianAuthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.loggedIn = source["loggedIn"];
	        this.displayName = source["displayName"];
	        this.email = source["email"];
	    }
	}
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

