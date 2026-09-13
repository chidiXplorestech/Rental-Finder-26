export function demoListings(){
  const now=new Date().toISOString();
  const base=[
    {title:"One bedroom apartment, Lace Market",rentPcm:875,bedrooms:1,floorAreaSqft:545,postcode:"NG1 1AA",postcodeDistrict:"NG1",propertyType:"flat",location:"Lace Market, Nottingham"},
    {title:"Two bedroom riverside apartment",rentPcm:950,bedrooms:2,floorAreaSqft:688,postcode:"NG2 1AA",postcodeDistrict:"NG2",propertyType:"flat",location:"Nottingham NG2"},
    {title:"Studio apartment near city centre",rentPcm:725,bedrooms:0,floorAreaSqft:410,postcode:"NG1 4AA",postcodeDistrict:"NG1",propertyType:"studio",location:"Nottingham City Centre"},
    {title:"Spacious two bedroom flat near Carrington",rentPcm:895,bedrooms:2,floorAreaSqft:642,postcode:"NG5 2AA",postcodeDistrict:"NG5",propertyType:"flat",location:"Carrington, Nottingham"},
    {title:"One bedroom flat in Beeston",rentPcm:825,bedrooms:1,floorAreaSqft:520,postcode:"NG9 2AA",postcodeDistrict:"NG9",propertyType:"flat",location:"Beeston, Nottingham"},
    {title:"Modern two bedroom house near tram corridor",rentPcm:990,bedrooms:2,floorAreaSqft:716,postcode:"NG9 2AB",postcodeDistrict:"NG9",propertyType:"house",location:"Beeston, Nottingham"},
  ];
  return base.map((x,i)=>({
    ...x,id:`demo-${i}`,source:"demo.rental-finder.local",sourceUrl:`https://example.com/demo-property-${i+1}`,imageUrl:null,
    studentOnly:false,professionalSuitability:"Demo: no student-only wording",availabilityStatus:"LIKELY_ACTIVE",freshnessLabel:"Demo data — not live",verificationMethod:"demo",discoveredAt:now,lastCheckedAt:now,firstSeenAt:now,isNew:i<2,timesSeen:i<2?1:4,demo:true,snippet:x.title
  }));
}
