export const MAX_PORTRAIT_EDGE=640;
export const MAX_PORTRAIT_BYTES=350000;
function dataUrlBytes(value){const base64=String(value).split(",")[1]||"";return Math.ceil(base64.length*3/4);}
function readAsDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("The image could not be read."));reader.readAsDataURL(blob);});}
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("This photo format could not be decoded. In Photos, use Share, Save to Files as JPEG, then try again."));image.src=url;});}
function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality));}
export async function preparePortrait(file,{maxEdge=MAX_PORTRAIT_EDGE,maxBytes=MAX_PORTRAIT_BYTES}={}){
 if(!file)throw new TypeError("Choose an image file.");
 const looksLikeImage=!file.type||file.type.startsWith("image/")||/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name||"");
 if(!looksLikeImage)throw new TypeError("Choose an image file.");
 const source=await readAsDataUrl(file),image=await loadImage(source),scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale)),canvas=document.createElement("canvas");
 canvas.width=width;canvas.height=height;const context=canvas.getContext("2d");if(!context)throw new Error("Image processing is unavailable on this device.");context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(image,0,0,width,height);
 let blob=null;for(const quality of [.82,.68,.54,.42]){blob=await canvasBlob(canvas,"image/jpeg",quality);if(blob&&blob.size<=maxBytes)break;}
 if(!blob)throw new Error("The image could not be compressed.");if(blob.size>maxBytes)throw new RangeError("The compressed image is still too large. Crop the photo and try again.");
 const dataUrl=await readAsDataUrl(blob);return {dataUrl,mimeType:"image/jpeg",width,height,bytes:dataUrlBytes(dataUrl),updatedAt:new Date().toISOString()};
}
