import type {ProviderSnapshot, QuotaWindow} from '../../shared/quota';
import {t, locale} from '../i18n';

export function cycleEstimate(w:QuotaWindow,_p:ProviderSnapshot,_now:number):{amount:string;lines:string[]}|null {
  const estimate = w.estimate;
  if (!estimate) return null;
  const {start, end, pricedTokens: priced, estimatedUsd: usd} = estimate;
  const money=new Intl.NumberFormat(locale.get(),{style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',maximumFractionDigits:2});
  const compact=new Intl.NumberFormat(locale.get(),{notation:'compact',maximumFractionDigits:1});
  const amount=money.format(estimate.projectedUsd);
  const date=new Intl.DateTimeFormat(locale.get(),{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  return {amount,lines:[t('usageCycleEstimate',{amount}),
    t('usageCycleRange',{start:date.format(start),end:date.format(end)}),
    t('usageCycleSample',{tokens:compact.format(priced),amount:money.format(usd),percent:w.usedPercent}),
    t('usageCycleLocal'),
    ...(estimate.incomplete ? [t('usageCycleIncomplete')] : [])]};
}
