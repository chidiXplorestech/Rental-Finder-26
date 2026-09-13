export function demoListings(filters={}) {
  const now=new Date().toISOString();
  const base=[
    {title:"Two bedroom riverside apartment",rentPcm:950,bedrooms:2,floorAreaSqft:688,postcode:"NG2 1AA",postcodeDistrict:"NG2",propertyType:"flat",commuteApproxMinutes:14,verified:true,score:96},
    {title:"Spacious two bedroom flat near Carrington",rentPcm:895,bedrooms:2,floorAreaSqft:642,postcode:"NG5 2AA",postcodeDistrict:"NG5",propertyType:"flat",commuteApproxMinutes:22,verified:true,score:91},
    {title:"Two bedroom apartment, Nottingham city fringe",rentPcm:975,bedrooms:2,floorAreaSqft:null,postcode:"NG3 1AA",postcodeDistrict:"NG3",propertyType:"flat",commuteApproxMinutes:16,verified:false,score:72},
    {title:"Modern two bedroom home near tram corridor",rentPcm:990,bedrooms:2,floorAreaSqft:716,postcode:"NG9 2AA",postcodeDistrict:"NG9",propertyType:"house",commuteApproxMinutes:28,verified:true,score:89},
    {title:"Central two bedroom apartment",rentPcm:995,bedrooms:2,floorAreaSqft:null,postcode:"NG1 4AA",postcodeDistrict:"NG1",propertyType:"flat",commuteApproxMinutes:8,verified:false,score:78},
    {title:"Two bedroom terrace, Lenton fringe",rentPcm:925,bedrooms:2,floorAreaSqft:665,postcode:"NG7 2AA",postcodeDistrict:"NG7",propertyType:"house",commuteApproxMinutes:17,verified:true,score:93}
  ];
  return base.filter(x => (!filters.maxRent||x.rentPcm<=filters.maxRent) && (!filters.bedrooms||x.bedrooms===filters.bedrooms) && (!filters.minSqft||!x.floorAreaSqft||x.floorAreaSqft>=filters.minSqft) && (filters.propertyType==="any"||!filters.propertyType||x.propertyType===filters.propertyType)).map((x,i)=>({
    ...x,id:`demo-${i}`,source:"demo.rental-finder.local",sourceUrl:"https://example.com/demo-property",imageUrl:null,location:x.postcode,
    studentOnly:false,professionalSuitability:"Demo: no student-only wording",availabilityStatus:"LIKELY_ACTIVE",freshnessLabel:"Demo data — not live",verificationMethod:"demo",discoveredAt:now,lastCheckedAt:now,demo:true
  }));
}
