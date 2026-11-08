import {useEffect} from 'react';
import {ADMIN_NAVIGATION_EVENT} from '../lib/adminNavigationGuard.js';
export function useAdminNavigationGuard(pending,label) {
  useEffect(()=>{
    if(!pending)return;
    const report=event=>event.detail.pending.push(label);
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener(ADMIN_NAVIGATION_EVENT,report);
    window.addEventListener('beforeunload',warn);
    return()=>{window.removeEventListener(ADMIN_NAVIGATION_EVENT,report);window.removeEventListener('beforeunload',warn);};
  },[pending,label]);
}
