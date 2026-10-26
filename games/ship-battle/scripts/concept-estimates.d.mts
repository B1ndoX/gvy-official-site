export interface Purpose {category:string;functional:boolean}
export function mission(ship:{id?:string;role?:string}):Purpose;
export function analogue(ship:{id:string;role?:string;manufacturer?:string;length?:number;facts?:Record<string,number>},key?:string):{id:string;role:string;manufacturer:string}|null;
