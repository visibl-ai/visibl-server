

const generateOPDS = (catalogueItems) => {
  const opdsResponse = {
    metadata: {
      title: "Visibl Catalog",
    },
    publications: catalogueItems.map((item) => ({
      metadata: {
        "@type": "http://schema.org/Audiobook",
        "title": item.title,
        "author": {
          name: item.author[0],
          sortAs: item.author[0].split(" ").reverse().join(", "),
        },
        "identifier": item.id,
        "language": item.language,
        "modified": new Date(item.updatedAt._seconds * 1000).toISOString(),
        "published": item.metadata.year,
        "duration": item.duration,
        "description": item.metadata.title, // You might want to add a separate description field to your catalogue items
        "visiblId": item.id,
      },
      images: [
        {
          href: item.cover,
          type: "image/jpeg",
        },
      ],
    })),
  };
  return opdsResponse;
};

export {
  generateOPDS,
};
