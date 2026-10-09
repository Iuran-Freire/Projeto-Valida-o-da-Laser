export function readingComparison(sources, length=14) {
  const panel=document.createElement('section');panel.className='reading-comparison';
  const heading=document.createElement('h3');heading.textContent='Leituras lado a lado';panel.append(heading);
  const differences=[];
  for(let i=0;i<length;i++){const chars=sources.map(([,value])=>value?.[i]).filter(Boolean);if(new Set(chars).size>1)differences.push(i);}
  const description=document.createElement('p');
  description.textContent=differences.length?`Diferenças nas posições: ${differences.map(i=>i+1).join(', ')}. Os caracteres diferentes estão sublinhados.`:sources.every(([,value])=>value?.length===length)?'Os caracteres exibidos coincidem. O resultado do registro também considera as demais validações.':'Leitura incompleta. Os espaços sem caractere aparecem como “—”.';
  panel.append(description);
  for(const [label,value] of sources){
    const row=document.createElement('div');row.className='reading-source';
    const title=document.createElement('strong');title.textContent=label;row.append(title);
    const cells=document.createElement('div');cells.className='reading-characters';cells.style.setProperty('--characters',length);
    cells.setAttribute('role','img');cells.setAttribute('aria-label',`${label}: ${value||'Não identificada'}`);
    for(let i=0;i<length;i++){const cell=document.createElement('span');cell.className='reading-character'+(differences.includes(i)?' different':'')+(!value?.[i]?' missing':'');cell.setAttribute('aria-hidden','true');const position=document.createElement('small');position.textContent=i+1;const char=document.createElement('b');char.textContent=value?.[i]||'—';cell.append(position,char);cells.append(cell);}
    row.append(cells);panel.append(row);
  }
  return panel;
}