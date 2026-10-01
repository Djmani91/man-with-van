// Core + service marketing pages. Copy sourced from the London SEO developer pack.
// Booking CTA keeps the existing working flow (-> /book).

const COMMON_FAQ = [
  { q: "Is this service available for my date?", a: "Availability is checked for your route, vehicle and crew. Sending your details does not reserve a slot until your booking is confirmed." },
  { q: "What if the job changes?", a: "Send the revised details before collection so scope, timing and price can be reviewed under the applicable terms." },
];

export const SERVICE_PAGES = {
  "man-with-van-london": {
    title: "Man With Van London | Get a Quote — Man With Van",
    description: "Plan a London move around your load, addresses and the help you need. Get a fixed quote for a local man and van across London.",
    h1: "Man With Van London",
    intro: "Plan a London move around your load, your addresses and the help you need. Whether you are moving boxes from a flat or collecting a piece of furniture, send the job details to get a quote for suitable transport. Collection times and loading arrangements are confirmed before the booking is final.",
    sections: [
      { h2: "Moving and delivery across London", body: "A man and van can suit room moves, selected furniture, student belongings and other loads that can be safely carried in the available vehicle. A larger home or complicated access may need an assessment before the right van and crew can be chosen. Use the individual service guides to explain your requirements clearly." },
      { h2: "What affects your London quote", body: "The addresses and road journey are only part of the job. Van space, load weight, carrying distance, crew, stairs and time on site can all affect the work. Your quote reflects the whole job — not just an hourly headline — so you know the price before you book." },
      { h2: "Choose the van and loading help", body: "List the largest items first and give their dimensions. Explain whether you can help with loading and whether any item needs two-person handling. A vehicle's usable space and payload both matter. If you are unsure, add photos so the right van is chosen." },
      { h2: "London areas", body: "Use our area directory to find borough and neighbourhood information. Confirm both collection and delivery addresses, including any stop outside London. Coverage and availability are checked for the actual job rather than assumed from the page name." },
      { h2: "Parking and building access", body: "Check where the van can legally stop at both addresses. Ask the building manager about lift reservations, loading bays and access windows, and follow the current street signs and relevant council or TfL guidance." },
    ],
    faqs: [
      { q: "Can I book a move for today?", a: "You can ask about a same-day move, but the vehicle, crew and collection time must be confirmed." },
      { q: "How do I know which van I need?", a: "Provide your item list, bulky-item measurements and any heavy items. The vehicle is assessed for both space and payload." },
      { q: "Is help carrying items included?", a: "Check the crew and included tasks in your quote. Tell us about stairs and heavy items before confirming." },
      { q: "Can the delivery be outside London?", a: "Include the full destination so route coverage and travel can be checked." },
    ],
  },
  "how-it-works": {
    title: "How to Book Your Move | Man With Van",
    description: "How booking a man and van works: send your move details, review your fixed quote, confirm, and prepare for collection.",
    h1: "How to Book Your Move",
    intro: "Booking is simple — send the details of your move, review a clear quote and confirm when you're ready.",
    sections: [
      { h2: "Send your move details", body: "Start with both addresses, your preferred date and an item list. Tell us about stairs, lift space and where a van can stop. Include multiple stops or dismantling requests at the start so the quote reflects the whole job." },
      { h2: "Review your quote", body: "Check the vehicle, crew, collection window, total price and included tasks. Ask about anything unclear, including waiting, extra items and changes to the route. A quote should match your actual move." },
      { h2: "Confirm the booking", body: "Choose how you'd like to pay and confirm. Read the cancellation and payment terms before committing. You'll receive confirmation once your driver is assigned." },
      { h2: "Prepare for collection", body: "Pack loose contents securely, label boxes and keep the access route clear. Have the collection contact ready and tell us promptly if the job details change." },
    ],
    faqs: COMMON_FAQ,
  },
  "faq": {
    title: "Moving & Booking Questions | Man With Van",
    description: "Answers to common man and van questions: quotes and payment, vehicles and loading, access and preparation, changes and support.",
    h1: "Moving and Booking Questions",
    intro: "Common questions about quotes, vans, access and changes.",
    sections: [],
    faqs: [
      { q: "What information is needed for a quote?", a: "The collection and delivery addresses, date, item list, dimensions of bulky items, loading help and access details. Tell us about extra stops and time restrictions." },
      { q: "Is the lowest hourly rate always the cheapest option?", a: "Compare the total expected charge and scope. Minimum time, crew, travel and access can change the final cost." },
      { q: "Can I choose a van based only on my property size?", a: "An inventory is more useful. Two homes of the same size can contain very different loads, and heavy items can affect the vehicle choice." },
      { q: "Can the driver carry everything alone?", a: "Some items need additional help. Describe weight and access before booking; don't assume one-person handling is suitable." },
      { q: "What should I check at a flat?", a: "Floors, stairs, lift dimensions, doorways, building access times and the distance from the unloading point to the entrance." },
      { q: "Can I add another collection?", a: "Ask before booking so the route, time and vehicle space can be assessed. Changes may affect the quote." },
      { q: "What happens if my details change?", a: "Contact support with your booking reference and revised requirements, and read the applicable change and cancellation policy." },
    ],
  },
  "contact": {
    title: "Contact Man With Van App | Get in Touch",
    description: "Contact Man With Van App. For a new move include the addresses, date and item list. For an existing booking include your reference.",
    h1: "Contact Man With Van App",
    intro: "For a new move, include the collection and delivery locations, preferred date and a brief item list. For an existing booking, include your booking reference and explain what help you need. Please don't send payment-card details in a general enquiry.",
    sections: [
      { h2: "New enquiries", body: "Use the quote form to send the details needed to assess your job. Include time limits and difficult access so they can be considered early." },
      { h2: "Existing bookings", body: "Use your account messages to reach your assigned driver or support. Explain any urgent change, such as an unavailable lift or revised collection time." },
    ],
    faqs: [],
  },
  "house-removals-london": {
    title: "House Removals London | Get a Quote — Man With Van",
    description: "Planning a house move in London? Plan the whole load room by room and get a fixed quote for the right van and crew.",
    h1: "House Removals London",
    intro: "A house move needs a plan for the entire load, not just a van. List furniture room by room, estimate the number of packed boxes and flag items that need dismantling. Share photographs when the load is difficult to estimate.",
    sections: [
      { h2: "Room-by-room inventory", body: "Start with each room and include items in lofts, sheds or storage cupboards. Distinguish packed contents from furniture and note anything that will remain at the old address." },
      { h2: "Packing and dismantling", body: "Say which tasks you will complete yourself. Packing materials, dismantling and reassembly should be agreed explicitly rather than assumed to be part of transport." },
      { h2: "Choosing the van and crew", body: "A larger volume may need a larger vehicle, more than one trip or a different team. Share access and weight information before choosing a package." },
      { h2: "Key collection and moving-day timings", body: "Coordinate key handover, access and the destination contact. Explain any uncertainty so waiting arrangements can be agreed in advance." },
    ],
    faqs: COMMON_FAQ,
  },
  "flat-removals-london": {
    title: "Flat Removals London | Get a Quote — Man With Van",
    description: "Flat move in London? Floors, lifts and carrying distance matter. Share access details and get a fixed quote for the right van and crew.",
    h1: "Flat Removals London",
    intro: "For a flat move, the distance from the front door to the van can matter as much as the road journey. Tell us the floor at each address, whether a lift is available and whether it can accommodate your largest item.",
    sections: [
      { h2: "Stairs, lifts and carrying distance", body: "Provide floor numbers at both properties and tell us if the lift is too small for furniture. Include the distance between the entrance and the loading point." },
      { h2: "Booking a loading bay", body: "Ask the building manager whether deliveries need a reserved slot or separate service entrance. Confirm any vehicle-height limit before choosing transport." },
      { h2: "Moving bulky furniture through doorways", body: "Measure the largest items against entrances and stair turns. Describe removable legs or sections, but don't assume dismantling is included." },
      { h2: "Planning a flat handover", body: "Allow time for the last items to be packed and for keys to be collected. Tell us if the destination cannot be accessed until a particular time." },
    ],
    faqs: COMMON_FAQ,
  },
  "student-removals-london": {
    title: "Student Removals London | Get a Quote — Man With Van",
    description: "Moving a student room in London? Combine luggage, boxes and larger items in one enquiry and get a fixed quote.",
    h1: "Student Removals London",
    intro: "Moving a student room usually means combining luggage, boxes and a few larger items. Count the boxes, measure your desk or shelving and explain whether you are moving alone or sharing the load with a housemate.",
    sections: [
      { h2: "Moving into or out of halls", body: "Check arrival or departure instructions with the accommodation provider. A booked moving slot and an available unloading point make planning easier." },
      { h2: "Shared-flat and end-of-term moves", body: "For a shared move, label belongings by person and destination. Include every stop in the enquiry rather than adding addresses after the price is agreed." },
      { h2: "Boxes, bikes and room furniture", body: "List luggage, boxes, desks and any bicycle separately. Protect loose or fragile belongings and keep essential documents with you." },
    ],
    faqs: COMMON_FAQ,
  },
  "furniture-delivery-london": {
    title: "Furniture Delivery London | Get a Quote — Man With Van",
    description: "Collecting furniture in London? Share item dimensions, seller collection and access details to get a fixed quote.",
    h1: "Furniture Delivery London",
    intro: "A furniture collection starts with the item measurements and the route out of the building. Ask the seller for width, depth and height, and check whether legs or sections can be removed.",
    sections: [
      { h2: "Furniture measurements and photos", body: "Include the dimensions of each item and a photograph where useful. Tell us about fragile surfaces, removable sections and unusually heavy pieces." },
      { h2: "Collection from sellers and shops", body: "Ask the seller or shop when the goods will be ready and who can release them. Check whether collection authorisation or an order reference is required." },
      { h2: "Doorways, stairs and room access", body: "Measure access at the destination as well as the collection point. Explain whether the requested drop-off is at the entrance or in a particular room." },
      { h2: "Protection and handling requirements", body: "Describe any packaging or handling needs. Confirm available protective materials and agreed responsibilities in the quote." },
    ],
    faqs: COMMON_FAQ,
  },
  "single-item-delivery-london": {
    title: "Single Item Delivery London | Get a Quote — Man With Van",
    description: "One heavy or awkward item in London? Share dimensions, weight and access so the right handling can be assessed. Get a quote.",
    h1: "Single Item Delivery London",
    intro: "One heavy or awkward item can still need two people and careful access planning. Tell us what the item is, its dimensions and approximate weight if known. A short journey does not remove the need to check lifting, parking and the route through the property.",
    sections: [
      { h2: "What counts as a single-item move", body: "A single-item booking describes the load, not the amount of work. A large table, appliance or wardrobe may need more handling than several small boxes." },
      { h2: "Weight and lifting requirements", body: "Provide an estimated weight only if you know it or can find manufacturer information. Flag uncertainty so suitable help can be assessed." },
      { h2: "Seller collection arrangements", body: "Agree a collection contact and make sure the item can be released during the arranged window. Check whether it must be dismantled before the van arrives." },
      { h2: "How a single-item quote is calculated", body: "Distance, access, crew and handling time all matter. Confirm the total scope and any waiting arrangements rather than expecting a price based only on mileage." },
    ],
    faqs: COMMON_FAQ,
  },
  "office-removals-london": {
    title: "Office Removals London | Get a Quote — Man With Van",
    description: "Office move in London? Organise by workstation or department, confirm loading access and get a fixed quote for van and crew.",
    h1: "Office Removals London",
    intro: "Organise an office move by workstation or department so items can be placed correctly at the destination. Identify furniture, labelled crates and equipment that need extra handling. Confirm loading access, lift reservations and any building induction before agreeing a schedule.",
    sections: [
      { h2: "Office inventory and labelling", body: "Prepare a list of desks, chairs, storage units and packed equipment. Labels should identify the destination room or workstation without exposing confidential information." },
      { h2: "Building management and loading access", body: "Check delivery entrances, lift reservations and building hours with both sites. Some premises require induction or a prearranged loading slot." },
      { h2: "IT equipment and confidential material", body: "Arrange device backup and disconnection with your own IT team unless a separate service has been confirmed. Keep confidential documents under your organisation's control." },
      { h2: "Scheduling to limit disruption", body: "Explain any deadline for reopening the office. Out-of-hours work is a request subject to availability, not an automatic inclusion." },
    ],
    faqs: COMMON_FAQ,
  },
  "same-day-man-with-van-london": {
    title: "Same-Day Man With Van London | Get a Quote",
    description: "Need an urgent London move? Send both addresses, item list and access details to check same-day availability and get a quote.",
    h1: "Same-Day Man With Van London",
    intro: "For an urgent move, send the essential information together: both addresses, the item list, access details and the latest acceptable collection time. A driver confirms a suitable van and crew before the job is booked.",
    sections: [
      { h2: "Check availability for today", body: "Send your details as early as possible and state the latest useful collection time. Suitable availability is checked for the whole job." },
      { h2: "Details needed for an urgent quote", body: "Include photos or dimensions of bulky items, all stops and access restrictions. Missing details can prevent a reliable urgent assessment." },
      { h2: "When your booking is confirmed", body: "Wait for explicit booking confirmation and an agreed time window before arranging a seller handover." },
      { h2: "Preparing for a short-notice move", body: "Pack and label your belongings while availability is being checked. Confirm that both addresses will be accessible and that someone can release and receive the items." },
    ],
    faqs: COMMON_FAQ,
  },
  "small-removals-london": {
    title: "Small Removals London | Get a Quote — Man With Van",
    description: "A small London move — a room, a few items or a part-load? Share your item list and access details to get a fixed quote.",
    h1: "Small Removals London",
    intro: "A small move may involve a single room, a handful of items or a part-load. Share your item list, bulky-item measurements and access details so the right van and crew can be matched to the job.",
    sections: [
      { h2: "What a small move includes", body: "A few boxes, a bed, a sofa or a studio flat can often be handled quickly. List the largest items first and note anything that needs two people." },
      { h2: "Access and carrying distance", body: "Tell us about stairs, lifts and how far the van can park from the door at both ends. Access often affects the time and crew needed." },
      { h2: "Choosing the right van", body: "A smaller van may be enough, but usable space and payload both matter. If you're unsure, add photos and we'll help match the vehicle." },
      { h2: "How to get your quote", body: "Send both addresses, your date, an item list and access details. Check the agreed vehicle, crew, scope and total price before confirming." },
    ],
    faqs: COMMON_FAQ,
  },
};

export const SERVICE_NAV = [
  { label: "House removals", slug: "house-removals-london" },
  { label: "Flat removals", slug: "flat-removals-london" },
  { label: "Student removals", slug: "student-removals-london" },
  { label: "Furniture delivery", slug: "furniture-delivery-london" },
  { label: "Single item delivery", slug: "single-item-delivery-london" },
  { label: "Office removals", slug: "office-removals-london" },
  { label: "Same-day man with van", slug: "same-day-man-with-van-london" },
  { label: "Small removals", slug: "small-removals-london" },
];
