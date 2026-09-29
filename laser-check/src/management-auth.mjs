const encoder=new TextEncoder();

export async function validManagementPassword(candidate,secret){
  if(typeof candidate!=='string'||!secret||candidate.length>256)return false;
  const [actual,expected]=await Promise.all([
    crypto.subtle.digest('SHA-256',encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256',encoder.encode(secret)),
  ]);
  const left=new Uint8Array(actual),right=new Uint8Array(expected);
  let difference=0;
  for(let i=0;i<left.length;i++)difference|=left[i]^right[i];
  return difference===0;
}

export function decodeManagementHeader(value){
  if(typeof value!=='string'||!value||value.length>512)return '';
  try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),char=>char.charCodeAt(0)));}
  catch{return '';}
}

export async function managementAttemptKey(ip,secret){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(secret+'\0'+ip)));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
