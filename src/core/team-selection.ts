import type {Management} from './domain';

/** Promote a seated manager by swapping seats; selecting an outsider replaces the chair. */
export function switchPrimaryManager(current:Management,id:string,profileIds:string[]):Management {
 if(!profileIds.includes(id))throw new Error('Choose an existing manager account.');
 const previous=current.primaryProfileId;
 const coordinatorIds=current.coordinatorIds.map(value=>value===id?previous:value).filter((value,index,all)=>value!==id&&all.indexOf(value)===index);
 const members=[id,...coordinatorIds];
 const names=Object.fromEntries(Object.entries(current.names??{}).filter(([key])=>members.includes(key)));
 const deciderIds=current.deciderIds?[id,...current.deciderIds.filter(value=>value!==id&&members.includes(value))]:undefined;
 return {primaryProfileId:id,coordinatorIds,...(Object.keys(names).length?{names}:{}),...(deciderIds?{deciderIds}:{}),...(current.decisionPolicy?{decisionPolicy:current.decisionPolicy}:{})};
}
