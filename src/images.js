export const MAX_PORTRAIT_EDGE=640;
export const MAX_PORTRAIT_BYTES=350000;
function dataUrlBytes(value){const base64=String(value).split(",")[1]||"";return Math.ceil(base64.length*3/4);}
function readAsDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("The image could not be read."));reader.readAsDataURL(blob);});}
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("The selected file is not a supported image."));image.src=url;});}
function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality));}
export async function preparePortrait(file,{maxEdge=MAX_PORTRAIT_EDGE,maxBytes=MAX_PORTRAIT_BYTES}={}){
 if(!file?.type?.startsWith("image/"))throw new TypeError("Choose an image file.");
 const sourceUrl=URL.createObjectURL(file);try{const image=await loadImage(sourceUrl),scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale)),canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const context=canvas.getContext("2d");context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(image,0,0,width,height);let blob=await canvasBlob(canvas,"image/webp",.82);if(!blob)blob=await canvasBlob(canvas,"image/jpeg",.82);if(!blob)throw new Error("The image could not be compressed.");if(blob.size>maxBytes){blob=await canvasBlob(canvas,blob.type,.62);}if(!blob||blob.size>maxBytes)throw new RangeError("The compressed image is still too large. Choose a smaller image.");const dataUrl=await readAsDataUrl(blob);return {dataUrl,mimeType:blob.type,width,height,bytes:dataUrlBytes(dataUrl),updatedAt:new Date().toISOString()};}finally{URL.revokeObjectURL(sourceUrl);}
}
