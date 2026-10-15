export function searchBands(width,height) {
 if(width<=0||height<=0)return [];
 const h=Math.ceil(height*.45);
 return [...new Set([Math.floor((height-h)/2),height-h,0])].map(y=>({x:0,y,w:width,h}));
}

export async function readCodeWithRetry(read,input,notify) {
 const options={formats:['QRCode','DataMatrix'],tryHarder:true,tryInvert:true,maxNumberOfSymbols:8};
 const valid=items=>items.filter(item=>item.isValid!==false);
 const first=valid(await read(input,options));
 // Preserve multiple-code warnings; never pick a preferred code from them.
 if(first.length)return first;
 notify('M09031D · tentando outro contraste para o código 2D…');
 return valid(await read(input,{...options,tryDenoise:true,binarizer:'GlobalHistogram'}));
}
